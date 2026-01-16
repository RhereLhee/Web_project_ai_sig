// lib/security.ts
// Security Utilities - TOTP, IP Whitelist, Audit

import * as OTPAuth from 'otpauth'
import { prisma } from './prisma'

// ============================================
// TOTP (Time-based One-Time Password)
// สำหรับ Admin 2FA - ใช้กับ Google Authenticator
// ============================================

export function generateTOTPSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 })
  return secret.base32
}

export function generateTOTPUri(
  secret: string,
  email: string,
  issuer: string = 'TechTrade'
): string {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  return totp.toString()
}

export function verifyTOTP(token: string, secret: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
    const delta = totp.validate({ token, window: 1 })
    return delta !== null
  } catch {
    return false
  }
}

export function generateTOTP(secret: string): string {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })
  return totp.generate()
}

// ============================================
// 2FA SETUP / MANAGEMENT
// ============================================

interface Setup2FAResult {
  success: boolean
  secret?: string
  qrCodeUri?: string
  error?: string
}

export async function initiate2FASetup(userId: string): Promise<Setup2FAResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, twoFactorEnabled: true },
  })

  if (!user) {
    return { success: false, error: 'ไม่พบผู้ใช้' }
  }

  if (user.role !== 'ADMIN') {
    return { success: false, error: 'เฉพาะ Admin เท่านั้น' }
  }

  if (user.twoFactorEnabled) {
    return { success: false, error: '2FA เปิดใช้งานอยู่แล้ว' }
  }

  const secret = generateTOTPSecret()
  const qrCodeUri = generateTOTPUri(secret, user.email || 'admin', 'TechTrade')

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret },
  })

  return { success: true, secret, qrCodeUri }
}

export async function confirm2FASetup(
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  })

  if (!user || !user.twoFactorSecret) {
    return { success: false, error: 'กรุณาเริ่ม setup 2FA ใหม่' }
  }

  if (user.twoFactorEnabled) {
    return { success: false, error: '2FA เปิดใช้งานอยู่แล้ว' }
  }

  const isValid = verifyTOTP(token, user.twoFactorSecret)
  if (!isValid) {
    return { success: false, error: 'รหัส OTP ไม่ถูกต้อง' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true },
  })

  return { success: true }
}

export async function disable2FA(
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  })

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, error: '2FA ไม่ได้เปิดใช้งาน' }
  }

  const isValid = verifyTOTP(token, user.twoFactorSecret)
  if (!isValid) {
    return { success: false, error: 'รหัส OTP ไม่ถูกต้อง' }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  })

  return { success: true }
}

export async function verify2FALogin(
  userId: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true, twoFactorEnabled: true },
  })

  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return { success: false, error: 'ผู้ใช้ไม่ได้เปิด 2FA' }
  }

  const isValid = verifyTOTP(token, user.twoFactorSecret)
  if (!isValid) {
    return { success: false, error: 'รหัส OTP ไม่ถูกต้อง' }
  }

  return { success: true }
}

// ============================================
// IP WHITELIST
// ============================================

export async function isIPWhitelisted(ip: string): Promise<boolean> {
  const count = await prisma.adminWhitelist.count({
    where: { isActive: true },
  })

  if (count === 0) return true

  const entry = await prisma.adminWhitelist.findFirst({
    where: { ip, isActive: true },
  })

  return !!entry
}

export async function addIPToWhitelist(
  ip: string,
  description?: string,
  addedBy?: string
): Promise<void> {
  await prisma.adminWhitelist.upsert({
    where: { ip },
    update: { isActive: true, description, addedBy },
    create: { ip, description, addedBy, isActive: true },
  })
}

export async function removeIPFromWhitelist(ip: string): Promise<void> {
  await prisma.adminWhitelist.update({
    where: { ip },
    data: { isActive: false },
  })
}

export async function getIPWhitelist() {
  return prisma.adminWhitelist.findMany({
    where: { isActive: true },
    select: { ip: true, description: true, addedBy: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
}

// ============================================
// AUDIT LOG
// ============================================

interface AuditLogData {
  userId?: string
  userEmail?: string | null
  action: string
  entity: string
  entityId?: string
  oldData?: Record<string, any>
  newData?: Record<string, any>
  ip?: string
  userAgent?: string
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  await prisma.auditLog.create({ data })
}

export async function getAuditLogs(options: {
  userId?: string
  entity?: string
  action?: string
  limit?: number
  offset?: number
}) {
  return prisma.auditLog.findMany({
    where: {
      userId: options.userId,
      entity: options.entity,
      action: options.action,
    },
    select: {
      id: true,
      userId: true,
      userEmail: true,
      action: true,
      entity: true,
      entityId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit || 50,
    skip: options.offset || 0,
  })
}

// ============================================
// HELPERS
// ============================================

export function getClientIP(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}

export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars) return '****'
  return data.substring(0, visibleChars) + '****'
}

export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) errors.push('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  if (!/[A-Z]/.test(password)) errors.push('รหัสผ่านต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว')
  if (!/[a-z]/.test(password)) errors.push('รหัสผ่านต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว')
  if (!/[0-9]/.test(password)) errors.push('รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว')

  return { valid: errors.length === 0, errors }
}
