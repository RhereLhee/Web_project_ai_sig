// app/api/trading/realtime/route.ts
// Proxy API สำหรับ Signal Room - ซ่อน URL จาก client

import { NextResponse } from 'next/server'

const RENDER_API_URL = "https://trading-api-83hs.onrender.com"
const LOCALHOST_API_URL = "http://localhost:8000"
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
  // Try Render first
  try {
    const response = await fetchWithTimeout(`${RENDER_API_URL}/api/realtime/all`, TIMEOUT)
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error) {
    console.log('Render API failed, trying localhost...')
  }

  // Fallback to localhost
  try {
    const response = await fetchWithTimeout(`${LOCALHOST_API_URL}/api/realtime/all`, TIMEOUT)
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    }
  } catch (error) {
    console.log('Localhost API also failed')
  }

  // Return mock data if both fail
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    countdown: 299,
    mode: 'offline',
    symbols: {}
  })
}
