// lib/device.ts
// Device Fingerprint - ตรวจจับและผูกเครื่อง

import { prisma } from './prisma'
import crypto from 'crypto'

// ============================================
// TYPES
// ============================================

export interface DeviceInfo {
  fingerprint: string
  userAgent: string
  ip: string
  browser?: string
  os?: string
  device?: string
  isMobile?: boolean
}

export interface DeviceCheckResult {
  isKnownDevice: boolean
  isNewDevice: boolean
  requiresVerification: boolean
  deviceId?: string
}

// ============================================
// DEVICE FINGERPRINT GENERATION
// ============================================

/**
 * สร้าง Device Fingerprint จาก request headers
 * ใช้ข้อมูลหลายอย่างรวมกันเพื่อระบุเครื่อง
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ip: string,
  acceptLanguage?: string,
  acceptEncoding?: string
): string {
  // รวมข้อมูลที่ค่อนข้างคงที่
  const data = [
    userAgent,
    acceptLanguage || '',
    acceptEncoding || '',
    // ไม่รวม IP เพราะเปลี่ยนบ่อย
  ].join('|')

  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
    .substring(0, 32) // ตัดให้สั้นลง
}

/**
 * Parse User-Agent เพื่อดึงข้อมูลเครื่อง
 */
export function parseUserAgent(userAgent: string): {
  browser: string
  os: string
  device: string
  isMobile: boolean
} {
  const ua = userAgent.toLowerCase()

  // Browser
  let browser = 'Unknown'
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
  else if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera'

  // OS
  let os = 'Unknown'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac os') || ua.includes('macos')) os = 'macOS'
  else if (ua.includes('linux') && !ua.includes('android')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'

  // Device type
  let device = 'Desktop'
  const isMobile = /mobile|android|iphone|ipad|tablet/i.test(ua)
  if (ua.includes('iphone')) device = 'iPhone'
  else if (ua.includes('ipad')) device = 'iPad'
  else if (ua.includes('android')) {
    device = ua.includes('mobile') ? 'Android Phone' : 'Android Tablet'
  }
  else if (isMobile) device = 'Mobile'

  return { browser, os, device, isMobile }
}

/**
 * สร้าง DeviceInfo จาก request
 */
export function getDeviceInfo(headers: Headers, ip: string): DeviceInfo {
  const userAgent = headers.get('user-agent') || ''
  const acceptLanguage = headers.get('accept-language') || ''
  const acceptEncoding = headers.get('accept-encoding') || ''

  const fingerprint = generateDeviceFingerprint(
    userAgent,
    ip,
    acceptLanguage,
    acceptEncoding
  )

  const parsed = parseUserAgent(userAgent)

  return {
    fingerprint,
    userAgent,
    ip,
    ...parsed,
  }
}

// ============================================
// DEVICE MANAGEMENT
// ============================================

/**
 * ตรวจสอบว่าเป็นเครื่องที่รู้จักหรือไม่
 */
export async function checkDevice(
  userId: string,
  deviceInfo: DeviceInfo
): Promise<DeviceCheckResult> {
  // หา device ที่ผูกกับ user
  const userDevices = await prisma.userDevice.findMany({
    where: { 
      userId,
      isActive: true,
    },
  })

  // ถ้าไม่มี device เลย = เครื่องใหม่
  if (userDevices.length === 0) {
    return {
      isKnownDevice: false,
      isNewDevice: true,
      requiresVerification: false, // เครื่องแรกไม่ต้อง verify
    }
  }

  // หา device ที่ตรงกับ fingerprint
  const matchedDevice = userDevices.find(
    d => d.fingerprint === deviceInfo.fingerprint
  )

  if (matchedDevice) {
    // อัปเดต last used
    await prisma.userDevice.update({
      where: { id: matchedDevice.id },
      data: { 
        lastUsedAt: new Date(),
        lastIp: deviceInfo.ip,
      },
    })

    return {
      isKnownDevice: true,
      isNewDevice: false,
      requiresVerification: false,
      deviceId: matchedDevice.id,
    }
  }

  // Fingerprint ไม่ตรง = เครื่องใหม่ ต้อง verify
  return {
    isKnownDevice: false,
    isNewDevice: true,
    requiresVerification: true,
  }
}

/**
 * บันทึก Device ใหม่
 */
export async function registerDevice(
  userId: string,
  deviceInfo: DeviceInfo,
  deviceName?: string
): Promise<string> {
  const device = await prisma.userDevice.create({
    data: {
      userId,
      fingerprint: deviceInfo.fingerprint,
      name: deviceName || `${deviceInfo.device} - ${deviceInfo.browser}`,
      userAgent: deviceInfo.userAgent,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      deviceType: deviceInfo.device,
      isMobile: deviceInfo.isMobile,
      lastIp: deviceInfo.ip,
      lastUsedAt: new Date(),
      isActive: true,
      isTrusted: true,
    },
  })

  return device.id
}

/**
 * ดึงรายการ Device ของ User
 */
export async function getUserDevices(userId: string) {
  return prisma.userDevice.findMany({
    where: { 
      userId,
      isActive: true,
    },
    orderBy: { lastUsedAt: 'desc' },
    select: {
      id: true,
      name: true,
      browser: true,
      os: true,
      deviceType: true,
      isMobile: true,
      lastIp: true,
      lastUsedAt: true,
      createdAt: true,
      isTrusted: true,
    },
  })
}

/**
 * ลบ Device (Logout จากเครื่องนั้น)
 */
export async function removeDevice(
  userId: string,
  deviceId: string
): Promise<boolean> {
  const result = await prisma.userDevice.updateMany({
    where: { 
      id: deviceId,
      userId, // ต้องเป็นของ user นี้เท่านั้น
    },
    data: { isActive: false },
  })

  return result.count > 0
}

/**
 * ลบ Device ทั้งหมด (Logout ทุกเครื่อง)
 */
export async function removeAllDevices(
  userId: string,
  exceptDeviceId?: string
): Promise<number> {
  const result = await prisma.userDevice.updateMany({
    where: { 
      userId,
      ...(exceptDeviceId ? { id: { not: exceptDeviceId } } : {}),
    },
    data: { isActive: false },
  })

  return result.count
}

// ============================================
// SUSPICIOUS ACTIVITY DETECTION
// ============================================

/**
 * ตรวจสอบ activity ที่น่าสงสัย
 */
export async function checkSuspiciousActivity(
  userId: string,
  deviceInfo: DeviceInfo
): Promise<{
  isSuspicious: boolean
  reasons: string[]
}> {
  const reasons: string[] = []

  // 1. ตรวจสอบจำนวน device
  const deviceCount = await prisma.userDevice.count({
    where: { userId, isActive: true },
  })

  if (deviceCount > 5) {
    reasons.push('มีการใช้งานจากหลายเครื่องมากเกินไป')
  }

  // 2. ตรวจสอบ login จากหลาย IP ในเวลาสั้น
  const recentLogins = await prisma.loginHistory.findMany({
    where: {
      userId,
      success: true,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // 1 ชั่วโมง
    },
    select: { ip: true },
    distinct: ['ip'],
  })

  if (recentLogins.length > 3) {
    reasons.push('มีการ login จากหลาย IP ในเวลาสั้น')
  }

  // 3. ตรวจสอบ failed login attempts
  const failedLogins = await prisma.loginHistory.count({
    where: {
      userId,
      success: false,
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24 ชั่วโมง
    },
  })

  if (failedLogins > 10) {
    reasons.push('มีการพยายาม login ผิดหลายครั้ง')
  }

  return {
    isSuspicious: reasons.length > 0,
    reasons,
  }
}
