// app/api/trading/symbols/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateSymbolSetting, getSymbolSettings } from '@/lib/trading-api'

export async function GET() {
  try {
    const settings = await getSymbolSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error fetching symbol settings:', error)
    return NextResponse.json({ success: false, settings: [] })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { symbol, enabled, threshold, notes } = body

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: 'Symbol is required' },
        { status: 400 }
      )
    }

    const success = await updateSymbolSetting(symbol, {
      enabled,
      threshold,
      notes,
    })

    return NextResponse.json({ success })
  } catch (error) {
    console.error('Error updating symbol setting:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update' },
      { status: 500 }
    )
  }
}
