// app/api/auth/login/route.ts
// Login Flow แบบง่าย:
// - User ปกติ: Email + Password
// - Admin: Email + Password + TOTP (ถ้าเปิด 2FA)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createTokens } from '@/lib/jwt'
import { 
  checkRateLimit, 
  RATE_LIMITS,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLogins,
  recordLoginHistory,
  resetRateLimit,
} from '@/lib/rate-limit'
import { 
  getClientIP, 
  createAuditLog,
  verify2FALogin,
} from '@/lib/security'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const { 
      email, 
      password, 
      totpCode,      // สำหรับ Admin 2FA (ถ้าเปิด)
    } = await req.json()
    
    const ip = getClientIP(req.headers)
    const userAgent = req.headers.get('user-agent') || ''

    // ============================================
    // 1. VALIDATE INPUT
    // ============================================
    if (!email || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอก email และ password' },
        { status: 400 }
      )
    }

    // ============================================
    // 2. RATE LIMIT (ตรวจสอบก่อน แต่ยังไม่นับ)
    // ============================================
    const rateLimit = await checkRateLimit(ip, 'LOGIN', RATE_LIMITS.LOGIN, false) // false = ไม่นับ
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่',
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429 }
      )
    }

    // ============================================
    // 3. FIND USER
    // ============================================
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        tokenVersion: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      }
    })

    if (!user || !user.password) {
      // ❌ Login ผิด → นับ Rate Limit
      await checkRateLimit(ip, 'LOGIN', RATE_LIMITS.LOGIN, true)
      
      return NextResponse.json(
        { error: 'Email หรือ password ไม่ถูกต้อง' },
        { status: 401 }
      )
    }

    // ============================================
    // 4. CHECK ACCOUNT LOCKOUT
    // ============================================
    const lockout = await checkAccountLockout(user.id)
    
    if (lockout.isLocked) {
      const remainingMinutes = Math.ceil(
        (lockout.lockedUntil!.getTime() - Date.now()) / 60000
      )
      
      await recordLoginHistory({
        userId: user.id,
        ip,
        userAgent,
        success: false,
        failReason: 'ACCOUNT_LOCKED',
      })
      
      return NextResponse.json(
        { 
          error: `บัญชีถูกล็อคชั่วคราว กรุณารออีก ${remainingMinutes} นาที`,
          lockedUntil: lockout.lockedUntil,
        },
        { status: 423 }
      )
    }

    // ============================================
    // 5. VERIFY PASSWORD
    // ============================================
    const validPassword = await bcrypt.compare(password, user.password)
    
    if (!validPassword) {
      // ❌ Login ผิด → นับ Rate Limit
      await checkRateLimit(ip, 'LOGIN', RATE_LIMITS.LOGIN, true)
      
      const result = await recordFailedLogin(user.id)
      
      await recordLoginHistory({
        userId: user.id,
        ip,
        userAgent,
        success: false,
        failReason: 'WRONG_PASSWORD',
      })

      if (result.isLocked) {
        return NextResponse.json(
          { 
            error: 'ลองผิดหลายครั้งเกินไป บัญชีถูกล็อค 30 นาที',
            lockedUntil: result.lockedUntil,
          },
          { status: 423 }
        )
      }

      return NextResponse.json(
        { 
          error: `Email หรือ password ไม่ถูกต้อง (เหลือ ${result.remainingAttempts} ครั้ง)`,
          remainingAttempts: result.remainingAttempts,
        },
        { status: 401 }
      )
    }

    // ============================================
    // 6. CHECK 2FA FOR ADMIN (ถ้าเปิดใช้งาน)
    // ============================================
    if (user.role === 'ADMIN' && user.twoFactorEnabled) {
      if (!totpCode) {
        return NextResponse.json({
          requires2FA: true,
          message: 'กรุณากรอกรหัส OTP จาก Authenticator App',
        })
      }

      const totpResult = await verify2FALogin(user.id, totpCode)
      
      if (!totpResult.success) {
        // ❌ 2FA ผิด → นับ Rate Limit
        await checkRateLimit(ip, 'LOGIN', RATE_LIMITS.LOGIN, true)
        
        await recordLoginHistory({
          userId: user.id,
          ip,
          userAgent,
          success: false,
          failReason: '2FA_FAILED',
        })

        return NextResponse.json(
          { error: 'รหัส OTP ไม่ถูกต้อง' },
          { status: 401 }
        )
      }
    }

    // ============================================
    // 7. LOGIN SUCCESS ✅
    // ============================================
    
    // Reset failed attempts
    await resetFailedLogins(user.id)
    
    // ✅ Login สำเร็จ → Reset Rate Limit ของ IP นี้
    try {
      await resetRateLimit(ip, 'LOGIN')
    } catch (e) {
      // Ignore if function doesn't exist
    }

    // Create tokens
    const payload = {
      userId: user.id,
      email: user.email || '',
      role: user.role as string,
      tokenVersion: user.tokenVersion,
    }

    const { accessToken, refreshToken } = await createTokens(payload)

    // Save refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      }
    })

    // Record login history
    await recordLoginHistory({
      userId: user.id,
      ip,
      userAgent,
      success: true,
    })

    // Audit log
    await createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ip,
      userAgent,
    })

    // ============================================
    // 8. SET COOKIES & RESPONSE
    // ============================================
    const response = NextResponse.json({
      success: true,
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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}