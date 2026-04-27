// app/api/auth/email-otp/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmailOTP, generateEmailOTP } from '@/lib/email'
import { formatPhoneNumber } from '@/lib/sms'

export async function POST(req: NextRequest) {
  try {
    const { email, phone, type = 'VERIFY' } = await req.json()

    // 1. Validate email
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'อีเมลไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()

    // 1.5 ถ้าเป็น REGISTER — เช็ค email/phone ซ้ำก่อนส่ง OTP จะได้บอกผู้ใช้ทันทีว่าอันไหนซ้ำ
    if (type === 'REGISTER') {
      const emailTaken = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      })
      if (emailTaken) {
        return NextResponse.json(
          { error: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ', field: 'email' },
          { status: 409 }
        )
      }

      if (phone) {
        const formattedPhone = formatPhoneNumber(phone)
        const phoneTaken = await prisma.user.findFirst({
          where: { phone: formattedPhone },
          select: { id: true },
        })
        if (phoneTaken) {
          return NextResponse.json(
            { error: 'เบอร์โทรนี้ถูกใช้งานแล้ว กรุณาใช้เบอร์อื่น', field: 'phone' },
            { status: 409 }
          )
        }
      }
    }

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
