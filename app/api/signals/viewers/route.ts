// app/api/signals/viewers/route.ts
// Lightweight in-memory viewer tracking for the FREE signal window.
// No DB required — numbers reset on server restart which is fine for daily social-proof.
//
// POST { sessionId: string } — register/refresh a viewer; returns { realCount, displayCount }
// GET                        — same, without registering a session
//
// displayCount is computed server-side from a time bucket so ALL users see the
// same number at the same time (prevents onsite "different number" exposure).
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { getTodayKeyBkk, secondsUntilFreeWindowEnd } from '@/lib/free-window'

export const dynamic = 'force-dynamic'

const SESSION_TTL_MS = 10 * 60 * 1000 // 10 min
const sessions = new Map<string, { date: string; lastSeen: number }>()

function pruneAndCount(date: string): number {
  const now = Date.now()
  for (const [id, s] of sessions) {
    if (s.date !== date || now - s.lastSeen > SESSION_TTL_MS) {
      sessions.delete(id)
    }
  }
  let count = 0
  for (const s of sessions.values()) {
    if (s.date === date) count++
  }
  return count
}

/** Day-of-week in Asia/Bangkok: 0=Sun, 1=Mon, …, 6=Sat */
function getDayOfWeekBkk(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
  }).format(now)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts)
}

/**
 * Deterministic fake display count based on the current time bucket.
 * All users calling at the same time get the exact same number.
 * Weekdays only (Mon–Fri) — weekends return realCount as-is.
 */
function computeDisplayCount(realCount: number, secondsUntilEnd: number): number {
  const day = getDayOfWeekBkk()
  const isWeekend = day === 0 || day === 6
  if (isWeekend) return realCount

  const WIND_DOWN_SECS = 15 * 60
  const now = Date.now()
  const BUCKET_MS = 3 * 60 * 1000
  const bucket = Math.floor(now / BUCKET_MS)

  const raw = Math.sin(bucket * 127.1 + 311.7) * 43758.5453
  const r1 = raw - Math.floor(raw)
  const r2 = Math.sin(bucket * 91.3 + 17.4) * 43758.5453
  const jitterNorm = (r2 - Math.floor(r2)) * 2 - 1

  if (secondsUntilEnd <= WIND_DOWN_SECS) {
    const progress = (WIND_DOWN_SECS - secondsUntilEnd) / WIND_DOWN_SECS
    const base = Math.round(35 - progress * 25)
    const jitter = Math.round(jitterNorm * 2)
    return Math.max(realCount, Math.max(8, base + jitter))
  }

  const base = 20 + Math.round(r1 * 30)
  const jitter = Math.round(jitterNorm * 3)
  return Math.max(realCount, Math.max(20, Math.min(50, base + jitter)))
}

export async function POST(req: NextRequest) {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { sessionId?: string } | null
  const sessionId = (body?.sessionId || '').trim()
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

  const date = getTodayKeyBkk()
  sessions.set(sessionId, { date, lastSeen: Date.now() })
  const realCount = pruneAndCount(date)
  const secondsUntilEnd = secondsUntilFreeWindowEnd()
  return NextResponse.json({ realCount, displayCount: computeDisplayCount(realCount, secondsUntilEnd) })
}

export async function GET() {
  const payload = await getCurrentUser()
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = getTodayKeyBkk()
  const realCount = pruneAndCount(date)
  const secondsUntilEnd = secondsUntilFreeWindowEnd()
  return NextResponse.json({ realCount, displayCount: computeDisplayCount(realCount, secondsUntilEnd) })
}
