// app/api/withdraw/route.ts
// User-initiated withdrawal request.
// Requires: SMS OTP, active Signal + Partner subscription, phone-locked bank account.
// Balance taken from LedgerEntry. Commissions reserved atomically (AVAILABLE → HOLDING).

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { getUserWithSubscription, hasActiveSubscription, hasSignalAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPhoneNumber } from '@/lib/sms'
import { createWithdrawal, WithdrawalError } from '@/lib/withdrawal'
import { getMinWithdrawSatang } from '@/lib/system-settings'
import { getIdempotencyKey, withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasActiveSubscription(user) || !hasSignalAccess(user)) {
      return NextResponse.json(
        { error: 'ต้องมีทั้ง Signal Access และ PRO Subscription ถึงจะถอนเงินได้' },
        { status: 403 },
      )
    }

    const { amount, bankCode, accountNumber, accountName, otpCode } = await req.json()

    // Validation
    if (!amount || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 },
      )
    }
    if (!otpCode || otpCode.length !== 6) {
      return NextResponse.json(
        { error: 'กรุณากรอกรหัส OTP 6 หลัก' },
        { status: 400 },
      )
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'จำนวนเงินไม่ถูกต้อง' },
        { status: 400 },
      )
    }
    const minAmount = await getMinWithdrawSatang()
    if (amount < minAmount) {
      return NextResponse.json(
        { error: `ขั้นต่ำในการถอนคือ ฿${(minAmount / 100).toLocaleString()}` },
        { status: 400 },
      )
    }

    // Phone
    const userWithPhone = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    })
    if (!userWithPhone?.phone) {
      return NextResponse.json(
        { error: 'กรุณาเพิ่มเบอร์โทรศัพท์ในโปรไฟล์ก่อนถอนเงิน' },
        { status: 400 },
      )
    }
    const formattedPhone = formatPhoneNumber(userWithPhone.phone)

    // OTP
    const otpRecord = await prisma.otpVerification.findFirst({
      where: { phone: userWithPhone.phone, type: 'WITHDRAW', verified: false },
      orderBy: { createdAt: 'desc' },
    })
    if (!otpRecord) {
      return NextResponse.json(
        { error: 'ไม่พบรหัส OTP กรุณาขอรหัสใหม่' },
        { status: 400 },
      )
    }
    if (new Date() > otpRecord.expiresAt) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่' },
        { status: 400 },
      )
    }
    if (otpRecord.attempts >= 5) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'ลองผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่' },
        { status: 400 },
      )
    }
    if (otpRecord.code !== otpCode) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      const remaining = 5 - otpRecord.attempts - 1
      return NextResponse.json(
        { error: `รหัส OTP ไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)` },
        { status: 400 },
      )
    }

    // 1 phone = 1 bank account (global)
    const existingWithdrawal = await prisma.withdrawal.findFirst({
      where: {
        userId: { not: user.id },
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
      include: { user: { select: { phone: true } } },
    })
    if (existingWithdrawal?.user?.phone) {
      const otherPhone = formatPhoneNumber(existingWithdrawal.user.phone)
      if (otherPhone === formattedPhone) {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์นี้ถูกใช้กับบัญชีอื่นแล้ว' },
          { status: 400 },
        )
      }
    }

    // Partner
    const partner = await prisma.partner.findUnique({ where: { userId: user.id } })
    if (!partner) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล Partner กรุณาสมัคร Partner ก่อน' },
        { status: 400 },
      )
    }

    // Idempotency: same client with same key gets the same response
    const idempKey = getIdempotencyKey(req)
    const actorIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const actorUa = req.headers.get('user-agent')

    const result = await withIdempotency(idempKey, 'withdraw_create', async () => {
      const withdrawal = await createWithdrawal({
        userId: user.id,
        partnerId: partner.id,
        amountSatang: amount,
        bankCode,
        accountNumber,
        accountName,
        phone: userWithPhone.phone!,
        actorIp,
        actorUa,
      })

      // Mark OTP verified + delete in one go (outside the withdrawal tx is OK)
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { verified: true },
      })
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } }).catch(() => {})

      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ 1-3 วันทำการ',
          withdrawal: {
            id: withdrawal.id,
            amount: withdrawal.amount,
            status: withdrawal.status,
          },
        },
      }
    })

    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    if (error instanceof WithdrawalError) {
      const status =
        error.code === 'INSUFFICIENT_BALANCE' || error.code === 'BELOW_MIN' ? 400 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status })
    }
    logger.error('Withdraw error', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// GET - ดูประวัติการถอน
export async function GET() {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return NextResponse.json({ withdrawals })
  } catch (error) {
    logger.error('Get withdrawals error', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
