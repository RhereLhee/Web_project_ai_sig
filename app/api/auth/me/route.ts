// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getUserWithSubscription } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await getUserWithSubscription()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({ user })
    
  } catch (error) {
    console.error('Get me error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}
