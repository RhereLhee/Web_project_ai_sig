// app/api/trading/recent-signals/route.ts
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // ดึง 10 รายการล่าสุดจาก ForwardSequence
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
  } catch (error) {
    console.error('Error fetching recent signals:', error)
    return NextResponse.json({ 
      signals: [],
      error: 'Failed to fetch signals' 
    }, { status: 500 })
  }
}
