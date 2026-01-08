// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { 
  verifyRefreshToken, 
  createAccessToken, 
  createRefreshToken,
  getTokensFromCookies,
} from '@/lib/jwt'

export async function POST(req: NextRequest) {
  try {
    const { refreshToken: bodyToken } = await req.json().catch(() => ({}))
    const { refreshToken: cookieToken } = await getTokensFromCookies()
    
    const refreshToken = bodyToken || cookieToken
    
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token' },
        { status: 401 }
      )
    }
    
    // Verify refresh token
    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      )
    }
    
    // ตรวจว่า user ยังมีอยู่ใน DB ไหม
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        refreshToken: true,
        tokenVersion: true,
      }
    })
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }
    
    // ตรวจ token version (ถ้า user เปลี่ยน password หรือ logout ทุกเครื่อง)
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      return NextResponse.json(
        { error: 'Token revoked' },
        { status: 401 }
      )
    }
    
    // สร้าง tokens ใหม่
    const newPayload = {
      userId: user.id,
      email: user.email || '',
      role: user.role as string,
      tokenVersion: user.tokenVersion,
    }
    
    const newAccessToken = await createAccessToken(newPayload)
    const newRefreshToken = await createRefreshToken(newPayload)
    
    // Update refresh token ใน DB
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken }
    })
    
    // Set cookies ใน response
    const response = NextResponse.json({
      success: true,
    })
    
    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60, // 15 minutes
      path: '/',
    })
    
    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })
    
    return response
    
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}