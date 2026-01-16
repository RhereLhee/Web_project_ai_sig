// app/api/auth/email-otp/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmailOTP, generateEmailOTP } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email, type = 'VERIFY' } = await req.json()

    // 1. Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'อีเมลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()

    // 2. Rate limit (5 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentOtps = await prisma.otpVerification.count({
      where: {
        phone: normalizedEmail, // ใช้ phone field เก็บ email
        type,
        createdAt: { gte: oneHourAgo },
      },
    })

    if (recentOtps >= 5) {
      return NextResponse.json(
        { error: 'ส่งอีเมลบ่อยเกินไป กรุณารอสักครู่' },
        { status: 429 }
      )
    }

    // 3. Generate OTP
    const otp = generateEmailOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

    // 4. Delete old OTPs
    await prisma.otpVerification.deleteMany({
      where: { phone: normalizedEmail, type },
    })

    // 5. Save new OTP
    await prisma.otpVerification.create({
      data: {
        phone: normalizedEmail,
        code: otp,
        type,
        expiresAt,
      },
    })

    // 6. Send email
    const result = await sendEmailOTP(normalizedEmail, otp)

    if (!result.success) {
      return NextResponse.json(
        { error: 'ไม่สามารถส่งอีเมลได้' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งรหัส OTP ไปยังอีเมลแล้ว',
      expiresIn: 300,
    })

  } catch (error) {
    console.error('Email OTP error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
