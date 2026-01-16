// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTokens } from '@/lib/jwt'
import { formatPhoneNumber } from '@/lib/sms'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, password, verificationToken, referralCode } = await req.json()

    // 1. Validate input
    if (!name || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบ' },
        { status: 400 }
      )
    }

    if (!verificationToken) {
      return NextResponse.json(
        { error: 'กรุณายืนยัน OTP ก่อนสมัครสมาชิก' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase()
    const formattedPhone = formatPhoneNumber(phone)

    // 2. Verify OTP token - ใช้ email แทน phone (เพราะ Email OTP เก็บ email ใน field phone)
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        id: verificationToken,
        phone: normalizedEmail,  // ✅ แก้จาก formattedPhone เป็น normalizedEmail
        type: 'REGISTER',
        verified: true,
      },
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณายืนยัน OTP ใหม่' },
        { status: 400 }
      )
    }

    // Check token age (10 minutes)
    const tokenAge = Date.now() - otpRecord.createdAt.getTime()
    if (tokenAge > 10 * 60 * 1000) {
      await prisma.otpVerification.delete({ where: { id: otpRecord.id } })
      return NextResponse.json(
        { error: 'Token หมดอายุ กรุณายืนยัน OTP ใหม่' },
        { status: 400 }
      )
    }

    // 3. Check existing user
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { phone: formattedPhone },
        ],
      },
    })

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return NextResponse.json(
          { error: 'อีเมลนี้ถูกใช้งานแล้ว' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว' },
        { status: 400 }
      )
    }

    // 4. Find referrer
    let referredById: string | null = null
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      })
      if (referrer) {
        referredById = referrer.id
      }
    }

    // 5. Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // 6. Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: formattedPhone,
        password: hashedPassword,
        phoneVerified: true,
        referredById,
      },
    })

    // 7. Delete OTP record
    await prisma.otpVerification.delete({ where: { id: otpRecord.id } })

    // 8. Create tokens and login
    const payload = {
      userId: user.id,
      email: user.email || '',
      role: user.role,
      tokenVersion: user.tokenVersion,
    }

    const { accessToken, refreshToken } = await createTokens(payload)

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    })

    // 9. Response with cookies
    const response = NextResponse.json({
      success: true,
      message: 'สมัครสมาชิกสำเร็จ',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    })

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response

  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}