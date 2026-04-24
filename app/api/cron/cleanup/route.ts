// app/api/cron/cleanup/route.ts
// Hourly cleanup: flip PENDING orders past expiresAt to FAILED, and purge expired
// IdempotencyKey rows so the table does not grow unbounded.
//
// Schedule (vercel.json):
//   { "path": "/api/cron/cleanup", "schedule": "0 * * * *" }   // every hour on the minute
//
// Safety rules:
//   - Only expire orders whose status is STILL PENDING and expiresAt is in the past.
//   - Orders with an attached slip (slipUrl != null) are NOT expired automatically —
//     the user paid; an admin must approve or reject. Those sit in PENDING indefinitely.
//   - Idempotency purge hard-deletes rows past expiresAt. Safe because these are
//     retry-dedup cache entries, not ledger records.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateCron } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

async function run() {
  const now = new Date()

  // Expire stale PENDING orders (no slip uploaded, past expiresAt).
  const expired = await prisma.order.updateMany({
    where: {
      status: 'PENDING',
      slipUrl: null,
      expiresAt: { not: null, lt: now },
    },
    data: { status: 'FAILED' },
  })

  // Purge expired idempotency keys.
  const purgedIdemp = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: now } },
  })

  return {
    expiredOrders: expired.count,
    purgedIdempotencyKeys: purgedIdemp.count,
  }
}

export async function GET(req: NextRequest) {
  const auth = authenticateCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  try {
    const result = await run()
    logger.info('Cleanup cron executed', { context: 'payment', metadata: result })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    logger.error('Cleanup cron failed', { context: 'payment', error })
    return NextResponse.json({ error: 'cron failed' }, { status: 500 })
  }
}

export const POST = GET
