// app/api/admin/signal-settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

const SIGNAL_PAIRS = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY']

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { symbol, enabled } = await request.json()

    // ถ้าเป็น ALL = เปิด/ปิดทั้งหมด
    if (symbol === 'ALL') {
      for (const pair of SIGNAL_PAIRS) {
        const key = `signal_${pair.toLowerCase()}_enabled`
        await prisma.systemSetting.upsert({
          where: { key },
          create: {
            key,
            value: enabled,
            label: `${pair} Signal Enabled`,
            group: 'signal',
          },
          update: {
            value: enabled,
          },
        })
      }
      return NextResponse.json({ success: true, message: `${enabled ? 'เปิด' : 'ปิด'}ทุกคู่เงินแล้ว` })
    }

    // ปิด/เปิดเฉพาะคู่เงินที่ระบุ
    if (!SIGNAL_PAIRS.includes(symbol)) {
      return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
    }

    const key = `signal_${symbol.toLowerCase()}_enabled`
    
    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        value: enabled,
        label: `${symbol} Signal Enabled`,
        group: 'signal',
      },
      update: {
        value: enabled,
      },
    })

    return NextResponse.json({ 
      success: true, 
      message: `${enabled ? 'เปิด' : 'ปิด'} ${symbol} แล้ว` 
    })
  } catch (error) {
    console.error('Signal settings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function GET() {
  try {
    await requireAdmin()

    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { startsWith: 'signal_' }
      }
    })

    const result: Record<string, boolean> = {}
    SIGNAL_PAIRS.forEach(pair => {
      const key = `signal_${pair.toLowerCase()}_enabled`
      const setting = settings.find(s => s.key === key)
      result[pair] = setting ? (setting.value as boolean) : true // default = true
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get signal settings error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
