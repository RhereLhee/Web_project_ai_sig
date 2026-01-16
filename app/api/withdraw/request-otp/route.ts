// app/api/withdraw/request-otp/route.ts
// ส่ง SMS OTP ก่อนถอนเงิน

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { sendOTP, generateOTP, isValidThaiPhone } from '@/lib/sms'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ดึงข้อมูล user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { 
        id: true, 
        phone: true,
        phoneVerified: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ตรวจสอบเบอร์โทร
    if (!user.phone) {
      return NextResponse.json(
        { error: 'กรุณาเพิ่มเบอร์โทรศัพท์ในโปรไฟล์ก่อนถอนเงิน' },
        { status: 400 }
      )
    }

    if (!isValidThaiPhone(user.phone)) {
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Rate limit: 3 ครั้ง/ชั่วโมง
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const recentOtps = await prisma.otpVerification.count({
      where: {
        phone: user.phone,
        type: 'WITHDRAW',
        createdAt: { gte: oneHourAgo },
      },
    })

    if (recentOtps >= 3) {
      return NextResponse.json(
        { error: 'ส่ง OTP บ่อยเกินไป กรุณารอสักครู่' },
        { status: 429 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 นาที

    // ลบ OTP เก่า
    await prisma.otpVerification.deleteMany({
      where: { 
        phone: user.phone, 
        type: 'WITHDRAW',
      },
    })

    // สร้าง OTP ใหม่
    await prisma.otpVerification.create({
      data: {
        phone: user.phone,
        code: otp,
        type: 'WITHDRAW',
        expiresAt,
      },
    })

    // ส่ง SMS
    const result = await sendOTP(user.phone, otp)

    if (!result.success) {
      console.error('Send SMS failed:', result.error)
      return NextResponse.json(
        { error: 'ไม่สามารถส่ง SMS ได้ กรุณาลองใหม่' },
        { status: 500 }
      )
    }

    // Mask เบอร์โทร
    const maskedPhone = user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')

    return NextResponse.json({
      success: true,
      message: `ส่งรหัส OTP ไปที่ ${maskedPhone} แล้ว`,
      expiresIn: 300,
    })

  } catch (error) {
    console.error('Withdraw OTP error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}