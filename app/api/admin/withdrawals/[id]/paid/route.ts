// app/api/admin/withdrawals/[id]/paid/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin()

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: params.id },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    }

    if (withdrawal.status !== 'APPROVED') {
      return NextResponse.json({ error: 'รายการนี้ยังไม่ได้รับการอนุมัติ' }, { status: 400 })
    }

    await prisma.withdrawal.update({
      where: { id: params.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    // Update related commissions to PAID
    await prisma.commission.updateMany({
      where: {
        userId: withdrawal.userId,
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark paid error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
