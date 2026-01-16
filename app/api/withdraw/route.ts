// app/api/withdraw/route.ts
// Withdraw API - ต้องยืนยัน SMS OTP + ล็อค 1 เบอร์ = 1 บัญชี

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { getUserWithSubscription, hasActiveSubscription, hasSignalAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { formatPhoneNumber } from '@/lib/sms'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // เช็คเงื่อนไข Signal + PRO
    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasSub = hasActiveSubscription(user)
    const hasSignal = hasSignalAccess(user)

    if (!hasSub || !hasSignal) {
      return NextResponse.json(
        { error: 'ต้องมีทั้ง Signal Access และ PRO Subscription ถึงจะถอนเงินได้' },
        { status: 403 }
      )
    }

    const { amount, bankName, accountNumber, accountName, otpCode } = await req.json()

    // ============================================
    // 1. VALIDATION
    // ============================================
    if (!amount || !bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    if (!otpCode || otpCode.length !== 6) {
      return NextResponse.json(
        { error: 'กรุณากรอกรหัส OTP 6 หลัก' },
        { status: 400 }
      )
    }

    const minAmount = 35000 // 350 บาท = 35000 satang
    if (amount < minAmount) {
      return NextResponse.json(
        { error: `ขั้นต่ำในการถอนคือ ฿${minAmount / 100}` },
        { status: 400 }
      )
    }

    // ============================================
    // 2. CHECK PHONE NUMBER
    // ============================================
    const userWithPhone = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    })

    if (!userWithPhone?.phone) {
      return NextResponse.json(
        { error: 'กรุณาเพิ่มเบอร์โทรศัพท์ในโปรไฟล์ก่อนถอนเงิน' },
        { status: 400 }
      )
    }

    const formattedPhone = formatPhoneNumber(userWithPhone.phone)

    // ============================================
    // 3. VERIFY OTP
    // ============================================
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phone: userWithPhone.phone,
        type: 'WITHDRAW',
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'ไม่พบรหัส OTP กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    // ตรวจสอบหมดอายุ
    if (new Date() > otpRecord.expiresAt) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    // ตรวจสอบจำนวนครั้งที่ลอง
    if (otpRecord.attempts >= 5) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'ลองผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    // ตรวจสอบ OTP
    if (otpRecord.code !== otpCode) {
      await prisma.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      })
      const remaining = 5 - otpRecord.attempts - 1
      return NextResponse.json(
        { error: `รหัส OTP ไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)` },
        { status: 400 }
      )
    }

    // ============================================
    // 4. CHECK: 1 เบอร์ = 1 บัญชีถอน (ป้องกัน Multi-Account)
    // ============================================
    const existingWithdrawal = await prisma.withdrawal.findFirst({
      where: {
        userId: { not: user.id },  // คนอื่น
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
      include: {
        user: { select: { phone: true } },
      },
    })

    // เช็คว่ามีคนอื่นใช้เบอร์นี้ถอนเงินไปแล้วหรือไม่
    if (existingWithdrawal?.user?.phone) {
      const otherPhone = formatPhoneNumber(existingWithdrawal.user.phone)
      if (otherPhone === formattedPhone) {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์นี้ถูกใช้กับบัญชีอื่นแล้ว' },
          { status: 400 }
        )
      }
    }

    // ============================================
    // 5. CHECK BALANCE
    // ============================================
    const balance = await prisma.commission.aggregate({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
      _sum: {
        amount: true,
      },
    })

    const availableBalance = balance._sum.amount || 0

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: 'ยอดเงินไม่เพียงพอ' },
        { status: 400 }
      )
    }

    // ============================================
    // 6. CREATE WITHDRAWAL REQUEST
    // ============================================
    
    // Mark OTP as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })

    // สร้างคำขอถอน
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        amount,
        bankName,
        accountNumber,
        accountName,
        status: 'PENDING',
      },
    })

    // ลบ OTP
    await prisma.otpVerification.delete({ where: { id: otpRecord.id } })

    return NextResponse.json({
      success: true,
      message: 'ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ 1-3 วันทำการ',
      withdrawal: {
        id: withdrawal.id,
        amount: withdrawal.amount,
        status: withdrawal.status,
      },
    })

  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}

// GET - ดูประวัติการถอน
export async function GET(req: NextRequest) {
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
    console.error('Get withdrawals error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}