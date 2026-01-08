// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTokens, setAuthCookies } from '@/lib/jwt'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, referralCode } = await req.json()
    
    // Validate
    if (!email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอก email และ password' },
        { status: 400 }
      )
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      )
    }
    
    // ตรวจ email ซ้ำ
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Email นี้ถูกใช้แล้ว' },
        { status: 400 }
      )
    }
    
    // หา referrer (ถ้ามี)
    let referredById: string | undefined
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true }
      })
      if (referrer) {
        referredById = referrer.id
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // สร้าง user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        referredById,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        referralCode: true,
      }
    })
    
    // สร้าง tokens
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    }
    
    const { accessToken, refreshToken } = await createTokens(payload)
    
    // บันทึก refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    })
    
    // Set cookies
    await setAuthCookies(accessToken, refreshToken)
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        referralCode: user.referralCode,
      },
      accessToken,
    })
    
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
