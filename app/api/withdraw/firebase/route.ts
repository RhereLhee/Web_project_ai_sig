// app/api/withdraw/firebase/route.ts
// Firebase-auth withdraw flow (no SMS OTP; phone lock enforced via Partner.withdrawPhone).
// Uses the same banking-grade helpers as /api/withdraw for ledger + commission reservation.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { getUserWithSubscription, hasActivePartner } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWithdrawal, WithdrawalError } from '@/lib/withdrawal'
import { getMinWithdrawSatang } from '@/lib/system-settings'
import { getIdempotencyKey, withIdempotency } from '@/lib/idempotency'
import { getAvailableForWithdraw } from '@/lib/ledger'
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

    if (!hasActivePartner(user)) {
      return NextResponse.json(
        { error: 'ต้องเป็น Partner ถึงจะถอนเงินได้' },
        { status: 403 },
      )
    }

    const { amount, phone, bankCode, accountNumber, accountName } = await req.json()

    if (!bankCode || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 },
      )
    }

    const partner = await prisma.partner.findUnique({ where: { userId: user.id } })
    if (!partner) {
      return NextResponse.json({ error: 'ไม่พบข้อมูล Partner' }, { status: 404 })
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    })

    // Validate amount
    const requestedAmountSatang = Math.round((amount || 0) * 100)
    if (!Number.isInteger(requestedAmountSatang) || requestedAmountSatang <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินไม่ถูกต้อง' }, { status: 400 })
    }
    const minAmount = await getMinWithdrawSatang()
    if (requestedAmountSatang < minAmount) {
      return NextResponse.json(
        { error: `ขั้นต่ำในการถอนคือ ฿${(minAmount / 100).toLocaleString()}` },
        { status: 400 },
      )
    }

    const availableBalance = await getAvailableForWithdraw(user.id)
    if (requestedAmountSatang > availableBalance) {
      return NextResponse.json({ error: 'ยอดเงินไม่เพียงพอ' }, { status: 400 })
    }

    // PHONE LOCK (1 เบอร์ = 1 บัญชี)
    let finalPhone: string
    if (partner.withdrawPhone) {
      finalPhone = partner.withdrawPhone
    } else {
      const phoneToUse = phone || userData?.phone
      if (!phoneToUse) {
        return NextResponse.json({ error: 'กรุณาระบุเบอร์โทรศัพท์' }, { status: 400 })
      }
      let formattedPhone = phoneToUse.replace(/\D/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '66' + formattedPhone.slice(1)
      }
      if (!formattedPhone.startsWith('66')) {
        formattedPhone = '66' + formattedPhone
      }

      const otherPartnerWithPhone = await prisma.partner.findFirst({
        where: {
          withdrawPhone: formattedPhone,
          userId: { not: user.id },
        },
      })
      if (otherPartnerWithPhone) {
        return NextResponse.json(
          { error: 'เบอร์โทรนี้ถูกใช้กับบัญชีอื่นแล้ว' },
          { status: 400 },
        )
      }

      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          withdrawPhone: formattedPhone,
          withdrawPhoneLockedAt: new Date(),
        },
      })
      finalPhone = formattedPhone
    }

    const idempKey = getIdempotencyKey(req)
    const actorIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const actorUa = req.headers.get('user-agent')

    const result = await withIdempotency(idempKey, 'withdraw_create', async () => {
      const withdrawal = await createWithdrawal({
        userId: user.id,
        partnerId: partner.id,
        amountSatang: requestedAmountSatang,
        bankCode,
        accountNumber,
        accountName,
        phone: finalPhone,
        actorIp,
        actorUa,
      })
      return {
        statusCode: 200,
        body: {
          success: true,
          message: 'ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ 1-3 วันทำการ',
          withdrawal: {
            id: withdrawal.id,
            amount: withdrawal.amount,
            amountBaht: withdrawal.amountBaht,
            status: withdrawal.status,
          },
        },
      }
    })

    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    if (error instanceof WithdrawalError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }
    logger.error('Withdraw Firebase error', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
