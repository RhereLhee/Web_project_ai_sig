// app/api/trading/realtime/route.ts
// Proxy API for Signal Room

import { NextResponse } from 'next/server'

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
