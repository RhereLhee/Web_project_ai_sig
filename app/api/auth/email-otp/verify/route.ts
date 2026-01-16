// app/api/auth/email-otp/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, code, type = 'REGISTER' } = body

    if (!email || !code) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบ' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()

    // ค้นหา OTP
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        phone: normalizedEmail, // ใช้ phone field เก็บ email
        type,
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

    // เช็คหมดอายุ
    if (new Date() > otpRecord.expiresAt) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    // เช็คจำนวนครั้ง
    if (otpRecord.attempts >= 5) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'ลองผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่' },
        { status: 400 }
      )
    }

    // เช็ครหัส
    if (otpRecord.code !== code) {
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

    // Mark as verified
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { verified: true },
    })

    return NextResponse.json({
      success: true,
      verificationToken: otpRecord.id,
    })

  } catch (error) {
    console.error('Email OTP verify error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}