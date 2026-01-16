// app/api/admin/withdrawals/[id]/reject/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: params.id },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอดำเนินการ' }, { status: 400 })
    }

    await prisma.withdrawal.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        rejectedBy: admin.userId,
        rejectedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reject withdrawal error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
