import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTokens, setAuthCookies } from '@/lib/jwt'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    
    if (!email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอก email และ password' },
        { status: 400 }
      )
    }
    
    // หา user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        tokenVersion: true,
      }
    })
    
    if (!user || !user.password) {
      return NextResponse.json(
        { error: 'Email หรือ password ไม่ถูกต้อง' },
        { status: 401 }
      )
    }
    
    // ตรวจ password
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json(
        { error: 'Email หรือ password ไม่ถูกต้อง' },
        { status: 401 }
      )
    }
    
    // สร้าง tokens - แปลง role เป็น string
    const payload = {
      userId: user.id,
      email: user.email || '',
      role: user.role as string, // ← แก้ตรงนี้
      tokenVersion: user.tokenVersion,
    }
    
    const { accessToken, refreshToken } = await createTokens(payload)
    
    // บันทึก refresh token ใน DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken }
    })
    
    // Set cookies
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
    
    // Set cookies manually
    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    })
    
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })
    
    return response
    
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}