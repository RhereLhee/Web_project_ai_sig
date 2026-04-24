// app/api/signals/free-status/route.ts
// GET — returns the current state of the FREE PLAN window + counter.
// Used by the signal-room UI to render the "X / 10" pill, the countdown,
// and the "ปิดจบวันนี้" lock state.
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import {
  FREE_DAILY_LIMIT,
  FREE_PAIR_DISPLAY,
  FREE_PAIR_SYMBOLS,
  FREE_WINDOW_END_HOUR,
  FREE_WINDOW_START_HOUR,
  getTodayKeyBkk,
  isInFreeWindow,
  secondsUntilFreeWindowEnd,
  secondsUntilFreeWindowStart,
} from '@/lib/free-window'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Require login so we at least know who is counting, but do NOT gate behind
  // any subscription — that's the whole point of free.
  const payload = await getCurrentUser()
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const date = getTodayKeyBkk(now)
  const inWindow = isInFreeWindow(now)
  const count = await prisma.freeSignalObservation.count({ where: { date } })
  const closed = count >= FREE_DAILY_LIMIT

  return NextResponse.json({
    date,
    inWindow,
    closed,
    count,
    limit: FREE_DAILY_LIMIT,
    pairs: FREE_PAIR_DISPLAY,
    pairSymbols: FREE_PAIR_SYMBOLS,
    windowStartHour: FREE_WINDOW_START_HOUR,
    windowEndHour: FREE_WINDOW_END_HOUR,
    secondsUntilEnd: secondsUntilFreeWindowEnd(now),
    secondsUntilStart: secondsUntilFreeWindowStart(now),
  })
}
