// app/api/trading/retrain/route.ts
// API สำหรับส่งคำสั่ง Retrain ไปยัง Python API

import { NextRequest, NextResponse } from 'next/server'
import { getUserWithSubscription } from '@/lib/auth'

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'https://trading-api-83hs.onrender.com'

const VALID_SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']

export async function POST(req: NextRequest) {
  try {
    // ตรวจสอบ Admin
    const user = await getUserWithSubscription()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { symbol } = body

    // Validate symbol
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    if (!VALID_SYMBOLS.includes(symbol)) {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      )
    }

    // ส่งคำสั่งไปยัง Python API
    const response = await fetch(`${PYTHON_API_URL}/retrain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ symbol }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { 
          success: false, 
          error: errorData.error || 'Failed to start retrain',
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      symbol,
      message: `Retrain started for ${symbol}`,
      ...data
    })

  } catch (error) {
    console.error('Retrain API error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to connect to Python API' },
      { status: 500 }
    )
  }
}