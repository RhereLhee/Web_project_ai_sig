// app/api/trading/realtime/route.ts
// Proxy API for Signal Room — requires authentication

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'

const RENDER_API_URL = process.env.TRADING_API_URL || "https://trading-api-83hs.onrender.com"
const TIMEOUT = 10000

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetchWithTimeout(`${RENDER_API_URL}/api/realtime/all`, TIMEOUT)
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch {
    // API unavailable
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    countdown: 0,
    mode: 'offline',
    symbols: {}
  })
}
