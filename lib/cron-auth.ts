// lib/cron-auth.ts
// Shared helper for authenticating scheduled invocations.
// External scheduler (Vercel Cron / external curl) must send CRON_SECRET in either:
//   - Authorization: Bearer <CRON_SECRET>
//   - x-cron-secret: <CRON_SECRET>
// If CRON_SECRET env is unset we refuse ALL requests (fail closed).

import { NextRequest } from 'next/server'

export interface CronAuthResult {
  ok: boolean
  reason?: string
}

export function authenticateCron(req: NextRequest): CronAuthResult {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return { ok: false, reason: 'CRON_SECRET not configured' }
  }

  const auth = req.headers.get('authorization')
  const headerToken = req.headers.get('x-cron-secret')

  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  const provided = headerToken || bearer

  if (!provided || provided !== secret) {
    return { ok: false, reason: 'Invalid or missing cron secret' }
  }
  return { ok: true }
}
