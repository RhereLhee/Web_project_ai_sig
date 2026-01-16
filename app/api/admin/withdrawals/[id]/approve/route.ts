// app/api/admin/withdrawals/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอดำเนินการ' }, { status: 400 })
    }

    await prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: admin.userId,
        approvedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Approve withdrawal error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}