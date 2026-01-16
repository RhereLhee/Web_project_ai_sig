// app/api/trading/retrain/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { sendRetrainCommand } from '@/lib/trading-api'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { symbol } = body

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol is required' },
        { status: 400 }
      )
    }

    const result = await sendRetrainCommand(symbol)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error sending retrain command:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send retrain command' },
      { status: 500 }
    )
  }
}
