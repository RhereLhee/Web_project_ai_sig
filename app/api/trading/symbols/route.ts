// app/api/trading/symbols/route.ts
// API สำหรับจัดการ Symbol Config (เปิด/ปิด Signal)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserWithSubscription } from '@/lib/auth'

// Default symbols
const DEFAULT_SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']

// GET - ดึงสถานะทุก Symbol
export async function GET() {
  try {
    // ดึง config จาก database
    const configs = await prisma.symbolConfig.findMany({
      orderBy: { symbol: 'asc' }
    })

    // สร้าง default ถ้ายังไม่มี
    const result = DEFAULT_SYMBOLS.map(symbol => {
      const config = configs.find(c => c.symbol === symbol)
      return {
        symbol,
        enabled: config?.enabled ?? true,
        threshold: config?.threshold ?? 0.82,
        notes: config?.notes ?? null,
        updatedAt: config?.updatedAt ?? null,
      }
    })

    return NextResponse.json({ symbols: result })
  } catch (error) {
    console.error('Error fetching symbol configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symbol configs' },
      { status: 500 }
    )
  }
}

// PUT - อัปเดตสถานะ Symbol
export async function PUT(req: NextRequest) {
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
    const { symbol, enabled, threshold } = body

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      )
    }

    // Validate symbol
    if (!DEFAULT_SYMBOLS.includes(symbol)) {
      return NextResponse.json(
        { error: 'Invalid symbol' },
        { status: 400 }
      )
    }

    // Upsert config
    const config = await prisma.symbolConfig.upsert({
      where: { symbol },
      update: {
        ...(enabled !== undefined && { enabled }),
        ...(threshold !== undefined && { threshold }),
      },
      create: {
        symbol,
        enabled: enabled ?? true,
        threshold: threshold ?? 0.82,
      }
    })

    return NextResponse.json({
      success: true,
      config: {
        symbol: config.symbol,
        enabled: config.enabled,
        threshold: config.threshold,
      }
    })
  } catch (error) {
    console.error('Error updating symbol config:', error)
    return NextResponse.json(
      { error: 'Failed to update symbol config' },
      { status: 500 }
    )
  }
}
