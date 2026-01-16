// app/api/trading/losses/route.ts
import { NextResponse } from 'next/server'
import { getLossHistory } from '@/lib/trading-api'

export async function GET() {
  try {
    const losses = await getLossHistory(50)
    
    return NextResponse.json({
      success: true,
      losses,
    })
  } catch (error) {
    console.error('Error fetching losses:', error)
    return NextResponse.json({
      success: false,
      losses: [],
    })
  }
}
