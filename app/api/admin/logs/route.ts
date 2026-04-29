// app/api/admin/logs/route.ts
// Admin API — ดู System Logs จาก Database

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const payload = await getCurrentUser()
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const level = searchParams.get('level') || undefined
  const context = searchParams.get('context') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '200'), 500)

  const where: Record<string, unknown> = {}
  if (level) where.level = level
  if (context) where.context = context

  const [logs, statsRaw] = await Promise.all([
    prisma.systemLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        level: true,
        message: true,
        context: true,
        userId: true,
        errorMessage: true,
        metadata: true,
        timestamp: true,
      },
    }),
    prisma.systemLog.groupBy({
      by: ['level'],
      _count: { _all: true },
    }),
  ])

  // Build stats
  const byLevel: Record<string, number> = {}
  let total = 0
  for (const r of statsRaw) {
    byLevel[r.level] = r._count._all
    total += r._count._all
  }

  // Context stats (separate query — only top contexts)
  const contextRaw = await prisma.systemLog.groupBy({
    by: ['context'],
    _count: { _all: true },
    orderBy: { context: 'asc' },
  })
  const byContext: Record<string, number> = {}
  // Sort by count desc, take top 20
  const sortedContext = contextRaw
    .filter(r => r.context)
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 20)
  for (const r of sortedContext) {
    byContext[r.context!] = r._count._all
  }

  // Format timestamps as ISO string for the client
  const formatted = logs.map(l => ({
    ...l,
    timestamp: l.timestamp.toISOString(),
  }))

  return NextResponse.json({ logs: formatted, stats: { total, byLevel, byContext } })
}
