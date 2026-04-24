// app/api/signals/free-observe/route.ts
// POST — called by the client each time it sees a new signal appear while a
// free user is inside the viewing window. The (date, symbol, entryTime) unique
// index dedupes; anything after the 10th observation of the day is rejected
// (and the frontend locks the view).
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import {
  FREE_DAILY_LIMIT,
  getTodayKeyBkk,
  isAllowedFreePair,
  isInFreeWindow,
} from '@/lib/free-window'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as {
      symbol?: string
      entryTime?: string
    } | null

    const symbol = (body?.symbol || '').trim()
    const entryTime = (body?.entryTime || '').trim()

    if (!symbol || !entryTime) {
      return NextResponse.json({ error: 'symbol and entryTime required' }, { status: 400 })
    }
    if (!isAllowedFreePair(symbol)) {
      return NextResponse.json({ error: 'pair not allowed on free plan', code: 'PAIR_BLOCKED' }, { status: 400 })
    }

    const now = new Date()
    if (!isInFreeWindow(now)) {
      return NextResponse.json({ error: 'outside free window', code: 'OUTSIDE_WINDOW' }, { status: 400 })
    }

    const date = getTodayKeyBkk(now)

    // Check cap BEFORE inserting so the client sees "closed" even if it's
    // racing the 10th signal. Small window for overshoot is fine — we also
    // refuse inserts past the limit below.
    const countBefore = await prisma.freeSignalObservation.count({ where: { date } })
    if (countBefore >= FREE_DAILY_LIMIT) {
      return NextResponse.json({
        ok: false,
        count: countBefore,
        limit: FREE_DAILY_LIMIT,
        closed: true,
        code: 'LIMIT_REACHED',
      })
    }

    let created = false
    try {
      await prisma.freeSignalObservation.create({
        data: { date, symbol, entryTime },
      })
      created = true
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Someone else already observed this exact signal today — not an error.
        created = false
      } else {
        throw e
      }
    }

    const count = await prisma.freeSignalObservation.count({ where: { date } })
    return NextResponse.json({
      ok: true,
      created,
      count,
      limit: FREE_DAILY_LIMIT,
      closed: count >= FREE_DAILY_LIMIT,
    })
  } catch (error) {
    logger.error('free-observe error', { context: 'signal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
