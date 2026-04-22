// lib/jwt.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// ใช้ lazy initialization — ไม่ throw ตอน build time
// แต่จะ throw ตอน runtime ถ้าไม่มี secret
function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) throw new Error('JWT_ACCESS_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

function getRefreshSecret() {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET environment variable is required')
  return new TextEncoder().encode(secret)
}

// Cache เพื่อไม่ต้อง encode ทุกครั้ง
let _accessSecret: Uint8Array | null = null
let _refreshSecret: Uint8Array | null = null

function getAccessSecretCached() {
  if (!_accessSecret) _accessSecret = getAccessSecret()
  return _accessSecret
}

function getRefreshSecretCached() {
  if (!_refreshSecret) _refreshSecret = getRefreshSecret()
  return _refreshSecret
}

// Token expiry - ปรับให้เหมาะสมกับการใช้งานจริง
const ACCESS_EXPIRY = '15m'     // 15 นาที (มาตรฐาน)
const REFRESH_EXPIRY = '7d'     // 7 วัน

export interface TokenPayload {
  userId: string
  email: string
  role: string
  tokenVersion?: number
}

// ============================================
// สร้าง Tokens
// ============================================

export async function createAccessToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXPIRY)
    .sign(getAccessSecretCached())
}

export async function createRefreshToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXPIRY)
    .sign(getRefreshSecretCached())
}

export async function createTokens(payload: TokenPayload) {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(payload),
    createRefreshToken(payload),
  ])
  return { accessToken, refreshToken }
}

// ============================================
// Verify Tokens
// ============================================

export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAccessSecretCached())
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getRefreshSecretCached())
    return payload as unknown as TokenPayload
  } catch {
    return null
  }
}

// ============================================
// Cookie Helpers
// ============================================

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  
  // Access Token - httpOnly สำหรับความปลอดภัย
  cookieStore.set('access_token', accessToken, {
    httpOnly: true,  // เปลี่ยนเป็น true - ป้องกัน XSS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 15 * 60,  // 15 นาที
    path: '/',
  })
  
  // Refresh Token - httpOnly + ความปลอดภัยสูงสุด
  cookieStore.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,  // 7 วัน
    path: '/',
  })
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete('access_token')
  cookieStore.delete('refresh_token')
}

export async function getTokensFromCookies() {
  const cookieStore = await cookies()
  return {
    accessToken: cookieStore.get('access_token')?.value,
    refreshToken: cookieStore.get('refresh_token')?.value,
  }
}

// ============================================
// Get Current User (Server Component)
// ============================================

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const { accessToken, refreshToken } = await getTokensFromCookies()
  
  // 1. ลองใช้ access token ก่อน
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken)
    if (payload) return payload
  }
  
  // 2. ถ้า access หมดอายุ ลอง refresh
  // แต่ไม่ set cookie ที่นี่ - ให้ redirect ไปยัง /api/auth/refresh แทน
  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken)
    if (payload) {
      // ส่ง payload กลับไป แต่ไม่ set cookie
      // Client จะต้องเรียก /api/auth/refresh เพื่อ renew token
      return payload
    }
  }
  
  return null
}

// ============================================
// Refresh Token Logic (ใช้ใน API Route เท่านั้น)
// ============================================

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; payload: TokenPayload } | null> {
  const payload = await verifyRefreshToken(refreshToken)
  if (!payload) return null
  
  const newAccessToken = await createAccessToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    tokenVersion: payload.tokenVersion,
  })
  
  return { accessToken: newAccessToken, payload }
}