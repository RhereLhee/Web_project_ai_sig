// app/api/admin/logs/route.ts
// Admin API — ดู System Logs + สถิติ Error
// เฉพาะ Admin เท่านั้นที่ดูได้

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { logStore, type LogEntry } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // ตรวจสิทธิ์ Admin
  const payload = await getCurrentUser()
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const level = searchParams.get('level') as LogEntry['level'] | null
  const context = searchParams.get('context')
  const limit = parseInt(searchParams.get('limit') || '100')

  const logs = logStore.getAll({
    level: level || undefined,
    context: context || undefined,
    limit: Math.min(limit, 500),
  })

  const stats = logStore.getStats()

  return NextResponse.json({
    logs,
    stats,
    filters: {
      level,
      context,
      limit,
    },
  })
}
