// app/api/trading/recent-signals/route.ts
// Returns recent signal results — requires authentication

import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getCurrentUser } from '@/lib/jwt'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sequences = await prisma.forwardSequence.findMany({
      orderBy: { entryTime: 'desc' },
      take: 10,
    })

    const signals = sequences.map(seq => ({
      id: seq.id,
      symbol: seq.symbol,
      signalType: seq.signalType,
      wonAtLevel: seq.wonAtLevel,
      isWin: seq.isWin,
      entryTime: seq.entryTime.toISOString(),
      totalProfit: seq.totalProfit,
    }))

    return NextResponse.json({
      signals,
      count: signals.length,
      lastUpdated: new Date().toISOString()
    })
  } catch {
    return NextResponse.json({
      signals: [],
      error: 'Failed to fetch signals'
    }, { status: 500 })
  }
}
