// app/api/admin/system/route.ts
// Admin API — จัดการ System Settings (Free Trial, Affiliate toggle)
// เก็บค่าใน SystemSetting table (ไม่กระทบข้อมูลในฐานข้อมูล)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

// ============================================
// DEFAULT SETTINGS
// ============================================
const DEFAULTS: Record<string, unknown> = {
  'free_trial_enabled': true,
  'free_trial_days': 30,
  'affiliate_enabled': false,  // ล็อคไว้ก่อน
}

// ============================================
// GET — ดึงค่า settings ทั้งหมด
// ============================================
export async function GET() {
  const payload = await getCurrentUser()
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await prisma.systemSetting.findMany({
    where: {
      key: { in: Object.keys(DEFAULTS) },
    },
  })

  // Merge defaults กับค่าที่เก็บจริง
  const result: Record<string, unknown> = { ...DEFAULTS }
  for (const s of settings) {
    result[s.key] = s.value
  }

  return NextResponse.json({ settings: result })
}

// ============================================
// POST — อัปเดตค่า setting
// ============================================
export async function POST(req: NextRequest) {
  const payload = await getCurrentUser()
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { key, value } = body

  if (!key || !(key in DEFAULTS)) {
    return NextResponse.json({ error: 'Invalid setting key' }, { status: 400 })
  }

  // Upsert setting
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: {
      key,
      value: value as never,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      group: 'system',
    },
  })

  logger.info(`Admin เปลี่ยนค่า ${key} = ${JSON.stringify(value)}`, {
    context: 'system',
    userId: payload.userId,
    metadata: { key, value },
  })

  return NextResponse.json({ success: true, key, value })
}
