// app/api/health/route.ts
// Health Check API — ใช้ร่วมกับ UptimeRobot/Cron เพื่อตรวจสอบว่าเว็บยังทำงานอยู่
// ถ้าเว็บล่ม UptimeRobot จะแจ้ง Telegram/LINE/Email ทันที

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {}
  let healthy = true

  // 1. ตรวจ Database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    healthy = false
  }

  // 2. ตรวจ Memory usage
  const memUsage = process.memoryUsage()
  const memMB = Math.round(memUsage.heapUsed / 1024 / 1024)
  checks.memory = `${memMB}MB`

  // 3. Uptime
  checks.uptime = `${Math.round(process.uptime())}s`

  // 4. Timestamp
  checks.timestamp = new Date().toISOString()

  return NextResponse.json({
    status: healthy ? 'ok' : 'degraded',
    checks,
  }, {
    status: healthy ? 200 : 503,
  })
}
