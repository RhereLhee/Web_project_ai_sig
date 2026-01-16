// lib/rate-limit.ts
// Rate Limiting Utility - ป้องกัน Brute Force Attack

import { prisma } from './prisma'

interface RateLimitConfig {
  maxAttempts: number      // จำนวนครั้งสูงสุด
  windowMinutes: number    // ช่วงเวลา (นาที)
  blockMinutes?: number    // เวลาที่ถูกบล็อค (นาที)
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfter?: number // seconds
}

// ============================================
// DEFAULT CONFIGS
// ============================================

export const RATE_LIMITS = {
  LOGIN: {
    maxAttempts: 10,        // เพิ่มจาก 5 เป็น 10 สำหรับทดสอบ
    windowMinutes: 15,
    blockMinutes: 30,
  },
  REGISTER: {
    maxAttempts: 5,
    windowMinutes: 60,
  },
  OTP_SEND: {
    maxAttempts: 5,
    windowMinutes: 60,
  },
  OTP_VERIFY: {
    maxAttempts: 10,
    windowMinutes: 15,
  },
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMinutes: 60,
  },
  API: {
    maxAttempts: 100,
    windowMinutes: 1,
  },
} as const

// ============================================
// IN-MEMORY RATE LIMITER (Simple)
// ============================================

const inMemoryStore = new Map<string, { count: number; windowStart: Date }>()

/**
 * Simple In-Memory Rate Limiter
 * ใช้สำหรับ development หรือ single instance
 */
export function checkRateLimitMemory(
  key: string,
  action: string,
  config: RateLimitConfig,
  increment: boolean = true
): RateLimitResult {
  const cacheKey = `${action}:${key}`
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMinutes * 60 * 1000)
  
  const entry = inMemoryStore.get(cacheKey)
  
  // ถ้าไม่มี entry หรือ entry เก่าเกินไป → reset
  if (!entry || entry.windowStart < windowStart) {
    if (increment) {
      inMemoryStore.set(cacheKey, { count: 1, windowStart: now })
    }
    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt: new Date(now.getTime() + config.windowMinutes * 60 * 1000),
    }
  }
  
  // เพิ่ม count ถ้า increment = true
  if (increment) {
    entry.count++
  }
  
  const allowed = entry.count <= config.maxAttempts
  const remaining = Math.max(0, config.maxAttempts - entry.count)
  const resetAt = new Date(entry.windowStart.getTime() + config.windowMinutes * 60 * 1000)
  
  if (!allowed) {
    const retryAfter = Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
    return { allowed, remaining, resetAt, retryAfter }
  }
  
  return { allowed, remaining, resetAt }
}

// ============================================
// DATABASE RATE LIMITER (Persistent)
// ============================================

/**
 * Database Rate Limiter
 * ใช้สำหรับ production / multiple instances
 * 
 * @param key - IP หรือ identifier
 * @param action - ประเภท action (LOGIN, REGISTER, etc.)
 * @param config - configuration
 * @param increment - true = นับ attempt, false = แค่ตรวจสอบ
 */
export async function checkRateLimit(
  key: string,
  action: string,
  config: RateLimitConfig,
  increment: boolean = true  // ✅ เพิ่ม parameter นี้
): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - config.windowMinutes * 60 * 1000)
  
  // นับจำนวน attempts ใน window
  const count = await prisma.rateLimitLog.count({
    where: {
      key,
      action,
      createdAt: { gte: windowStart },
    },
  })
  
  const allowed = count < config.maxAttempts
  const remaining = Math.max(0, config.maxAttempts - count - (increment ? 1 : 0))
  const resetAt = new Date(now.getTime() + config.windowMinutes * 60 * 1000)
  
  // ✅ บันทึก attempt เฉพาะเมื่อ increment = true และ allowed
  if (allowed && increment) {
    await prisma.rateLimitLog.create({
      data: {
        key,
        action,
        windowStart: now,
      },
    })
  }
  
  if (!allowed) {
    const retryAfter = Math.ceil(config.windowMinutes * 60)
    return { allowed, remaining: 0, resetAt, retryAfter }
  }
  
  return { allowed, remaining, resetAt }
}

/**
 * Reset rate limit สำหรับ key
 */
export async function resetRateLimit(key: string, action: string): Promise<void> {
  await prisma.rateLimitLog.deleteMany({
    where: { key, action },
  })
  
  // Clear in-memory too
  inMemoryStore.delete(`${action}:${key}`)
}

/**
 * Clean up old rate limit logs (run via cron)
 */
export async function cleanupRateLimitLogs(olderThanHours: number = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
  
  const result = await prisma.rateLimitLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  })
  
  return result.count
}

// ============================================
// ACCOUNT LOCKOUT
// ============================================

interface LockoutResult {
  isLocked: boolean
  lockedUntil?: Date
  failedAttempts: number
  remainingAttempts: number
}

const LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutMinutes: 30,
}

/**
 * ตรวจสอบว่า account ถูก lock หรือไม่
 */
export async function checkAccountLockout(userId: string): Promise<LockoutResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  })
  
  if (!user) {
    return {
      isLocked: false,
      failedAttempts: 0,
      remainingAttempts: LOCKOUT_CONFIG.maxFailedAttempts,
    }
  }
  
  const now = new Date()
  
  // ถ้า lock หมดอายุแล้ว → reset
  if (user.lockedUntil && user.lockedUntil <= now) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })
    
    return {
      isLocked: false,
      failedAttempts: 0,
      remainingAttempts: LOCKOUT_CONFIG.maxFailedAttempts,
    }
  }
  
  // ยังถูก lock อยู่
  if (user.lockedUntil && user.lockedUntil > now) {
    return {
      isLocked: true,
      lockedUntil: user.lockedUntil,
      failedAttempts: user.failedLoginAttempts,
      remainingAttempts: 0,
    }
  }
  
  return {
    isLocked: false,
    failedAttempts: user.failedLoginAttempts,
    remainingAttempts: Math.max(0, LOCKOUT_CONFIG.maxFailedAttempts - user.failedLoginAttempts),
  }
}

/**
 * บันทึก failed login attempt
 */
export async function recordFailedLogin(userId: string): Promise<LockoutResult> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: { increment: 1 },
    },
    select: {
      failedLoginAttempts: true,
    },
  })
  
  const remainingAttempts = Math.max(0, LOCKOUT_CONFIG.maxFailedAttempts - user.failedLoginAttempts)
  
  // ถ้าเกิน limit → lock account
  if (user.failedLoginAttempts >= LOCKOUT_CONFIG.maxFailedAttempts) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_CONFIG.lockoutMinutes * 60 * 1000)
    
    await prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    })
    
    return {
      isLocked: true,
      lockedUntil,
      failedAttempts: user.failedLoginAttempts,
      remainingAttempts: 0,
    }
  }
  
  return {
    isLocked: false,
    failedAttempts: user.failedLoginAttempts,
    remainingAttempts,
  }
}

/**
 * Reset failed login attempts หลัง login สำเร็จ
 */
export async function resetFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })
}

// ============================================
// LOGIN HISTORY
// ============================================

interface LoginHistoryData {
  userId: string
  ip?: string
  userAgent?: string
  success: boolean
  failReason?: string
}

/**
 * บันทึกประวัติการ login
 */
export async function recordLoginHistory(data: LoginHistoryData): Promise<void> {
  await prisma.loginHistory.create({
    data: {
      userId: data.userId,
      ip: data.ip,
      userAgent: data.userAgent,
      device: parseDevice(data.userAgent),
      success: data.success,
      failReason: data.failReason,
    },
  })
  
  // อัปเดต last login ถ้าสำเร็จ
  if (data.success) {
    await prisma.user.update({
      where: { id: data.userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: data.ip,
      },
    })
  }
}

/**
 * Parse device from User-Agent
 */
function parseDevice(userAgent?: string): string {
  if (!userAgent) return 'Unknown'
  
  if (/iPhone/i.test(userAgent)) return 'iPhone'
  if (/iPad/i.test(userAgent)) return 'iPad'
  if (/Android/i.test(userAgent)) return 'Android'
  if (/Windows/i.test(userAgent)) return 'Windows'
  if (/Mac/i.test(userAgent)) return 'Mac'
  if (/Linux/i.test(userAgent)) return 'Linux'
  
  return 'Other'
}

/**
 * ดึงประวัติ login ล่าสุด
 */
export async function getLoginHistory(
  userId: string,
  limit: number = 10
): Promise<Array<{
  ip: string | null
  device: string | null
  success: boolean
  failReason: string | null
  createdAt: Date
}>> {
  return prisma.loginHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      ip: true,
      device: true,
      success: true,
      failReason: true,
      createdAt: true,
    },
  })
}