// app/api/admin/orders/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { distributeCommission } from '@/lib/affiliate'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // ← แก้ตรงนี้
) {
  try {
    await requireAdmin()

    const { id: orderId } = await params

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        partner: true,
        user: { select: { id: true, email: true, name: true } },
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'ไม่พบออเดอร์' }, { status: 404 })
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'ออเดอร์นี้ไม่อยู่ในสถานะรอดำเนินการ' }, { status: 400 })
    }

    const now = new Date()

    // ============================================
    // 1. UPDATE ORDER STATUS
    // ============================================
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paidAt: now,
      },
    })

    // ============================================
    // 2. ACTIVATE PRODUCT BASED ON ORDER TYPE
    // ============================================
    if (order.orderType === 'PARTNER' && order.partnerId) {
      // Partner Order
      const partner = await prisma.partner.findUnique({
        where: { id: order.partnerId },
      })
      
      const endDate = new Date(now)
      endDate.setMonth(endDate.getMonth() + (partner?.durationMonths || 1))

      await prisma.partner.update({
        where: { id: order.partnerId },
        data: {
          status: 'ACTIVE',
          startDate: now,
          endDate,
        },
      })

      // Update user role to PARTNER
      await prisma.user.update({
        where: { id: order.userId },
        data: { role: 'PARTNER' },
      })

    } else if (order.orderType === 'SIGNAL') {
      // Signal Order - ดึง months จาก metadata หรือ default 1 เดือน
      const metadata = order.metadata as any
      const months = metadata?.months || 1
      const bonusMonths = metadata?.bonus || 0
      const totalMonths = months + bonusMonths

      const endDate = new Date(now)
      endDate.setMonth(endDate.getMonth() + totalMonths)

      // Check if user already has signal subscription
      const existingSignal = await prisma.signalSubscription.findFirst({
        where: { userId: order.userId },
      })

      if (existingSignal) {
        // Extend existing subscription
        const currentEnd = existingSignal.endDate > now ? existingSignal.endDate : now
        const newEndDate = new Date(currentEnd)
        newEndDate.setMonth(newEndDate.getMonth() + totalMonths)

        await prisma.signalSubscription.update({
          where: { id: existingSignal.id },
          data: {
            status: 'ACTIVE',
            endDate: newEndDate,
          },
        })
      } else {
        // Create new subscription
        await prisma.signalSubscription.create({
          data: {
            userId: order.userId,
            status: 'ACTIVE',
            startDate: now,
            endDate,
            price: order.finalAmount,
          },
        })
      }
    }

    // ============================================
    // 3. DISTRIBUTE AFFILIATE COMMISSION
    // ============================================
    const affiliateResult = await distributeCommission(orderId, order.userId)

    if (affiliateResult.success && affiliateResult.distributed > 0) {
      console.log(`[Order ${orderId}] Distributed ${affiliateResult.distributed} commissions`)
    }

    // ============================================
    // 4. RESPONSE
    // ============================================
    return NextResponse.json({ 
      success: true,
      message: 'อนุมัติออเดอร์สำเร็จ',
      affiliate: {
        distributed: affiliateResult.distributed,
        totalAmount: affiliateResult.commissions.reduce((s, c) => s + c.amount, 0),
      },
    })

  } catch (error) {
    console.error('Approve order error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}