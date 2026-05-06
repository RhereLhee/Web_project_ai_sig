// app/api/health/route.ts
// Health Check API for UptimeRobot/Cron monitoring

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  let healthy = true

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    healthy = false
  }

  return NextResponse.json({
    status: healthy ? 'ok' : 'degraded',
  }, {
    status: healthy ? 200 : 503,
  })
}
