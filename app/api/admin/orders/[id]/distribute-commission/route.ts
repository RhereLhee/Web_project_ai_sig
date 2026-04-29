// app/api/admin/orders/[id]/distribute-commission/route.ts
//
// Manually trigger affiliate commission distribution for an already-PAID order.
// Useful when:
//   - The order was approved while affiliate was disabled
//   - Distribution failed silently during approve
//
// Safe to call multiple times — distributeCommission() is idempotent via
// AffiliatePayment.orderId UNIQUE constraint.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { distributeCommission } from '@/lib/affiliate'
import { logger } from '@/lib/logger'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id: orderId } = await params

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        isFirstPayment: true,
        userId: true,
        affiliatePayment: { select: { id: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'ไม่พบออเดอร์' }, { status: 404 })
    }
    if (order.status !== 'PAID') {
      return NextResponse.json({ error: 'ออเดอร์ยังไม่ได้รับการอนุมัติ' }, { status: 400 })
    }
    if (!order.isFirstPayment) {
      return NextResponse.json({ error: 'ออเดอร์นี้ไม่ใช่การสั่งซื้อครั้งแรก (ไม่มี commission)' }, { status: 400 })
    }
    if (order.affiliatePayment) {
      return NextResponse.json({ error: 'แจก commission ไปแล้ว', alreadyDistributed: true }, { status: 400 })
    }

    const result = await distributeCommission(orderId, order.userId)

    logger.info(`Manual commission distribution for order ${order.orderNumber}`, {
      context: 'affiliate',
      metadata: { orderId, result },
    })

    return NextResponse.json({
      success: true,
      distributed: result.distributed,
      totalPool: result.totalPool,
      totalPaid: result.totalPaid,
      dust: result.dust,
    })
  } catch (error) {
    logger.error('Manual commission distribution failed', { context: 'affiliate', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
