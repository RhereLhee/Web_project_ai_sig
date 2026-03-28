// lib/csrf.ts
// CSRF Protection — ตรวจสอบ Origin/Referer header สำหรับ state-changing requests

import { NextRequest } from 'next/server'

/**
 * ตรวจสอบว่า request มาจาก origin ที่ถูกต้อง
 * ใช้สำหรับ POST/PUT/DELETE requests
 */
export function validateCSRF(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  const host = req.headers.get('host')

  // ไม่ต้องเช็ค GET/HEAD/OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return true
  }

  // ถ้าไม่มี origin และ referer (เช่น API call จาก server) — ข้ามการตรวจสอบ
  if (!origin && !referer) {
    return true
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const allowedOrigins = [
    appUrl,
    `https://${host}`,
    `http://${host}`,
  ].filter(Boolean)

  // เช็ค Origin header
  if (origin) {
    return allowedOrigins.some(allowed => origin.startsWith(allowed))
  }

  // เช็ค Referer header (fallback)
  if (referer) {
    return allowedOrigins.some(allowed => referer.startsWith(allowed))
  }

  return false
}
