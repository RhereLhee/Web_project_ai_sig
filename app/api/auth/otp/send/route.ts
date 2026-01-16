// app/api/auth/otp/send/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendOTP, generateOTP, isValidThaiPhone, formatPhoneNumber } from '@/lib/sms'

export async function POST(req: NextRequest) {
  try {
    const { phone, type = 'REGISTER' } = await req.json()

    // 1. Validate phone
    if (!phone || !isValidThaiPhone(phone)) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const formattedPhone = formatPhoneNumber(phone)

    // 2. Check if phone already registered (for REGISTER type)
    if (type === 'REGISTER') {
      const existingUser = await prisma.user.findFirst({
        where: { phone: formattedPhone },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' },
          { status: 400 }
        )
      }
    }

    // 3. Rate limit check (max 3 OTPs per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentOtps = await prisma.otpVerification.count({
      where: {
        phone: formattedPhone,
        type,
        createdAt: { gte: oneHourAgo },
      },
    })

    if (recentOtps >= 3) {
      return NextResponse.json(
        { error: 'ส่ง OTP บ่อยเกินไป กรุณารอ 1 ชั่วโมง' },
        { status: 429 }
      )
    }

    // 4. Generate OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // 5. Delete old OTPs
    await prisma.otpVerification.deleteMany({
      where: { phone: formattedPhone, type },
    })

    // 6. Save new OTP
    await prisma.otpVerification.create({
      data: {
        phone: formattedPhone,
        code: otp,
        type,
        expiresAt,
      },
    })

    // 7. Send SMS
    const result = await sendOTP(formattedPhone, otp)

    if (!result.success) {
      return NextResponse.json(
        { error: 'ไม่สามารถส่ง SMS ได้ กรุณาลองใหม่' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งรหัส OTP แล้ว',
      expiresIn: 300,
    })

  } catch (error) {
    console.error('OTP send error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
