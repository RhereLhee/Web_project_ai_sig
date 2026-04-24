// app/api/admin/orders/[id]/approve/route.ts
// Admin approves a PENDING order after verifying payment.
// Wrapped in a single transaction so either everything succeeds or nothing does.
// Idempotent: re-invocation for same orderId returns the cached response.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { distributeCommission } from '@/lib/affiliate'
import { logger } from '@/lib/logger'
import { isAffiliateEnabled } from '@/lib/system-settings'
import { getIdempotencyKey, withIdempotency } from '@/lib/idempotency'
import { Prisma } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id: orderId } = await params

    // Idempotency: key by (admin, order, action)
    const idempKey = getIdempotencyKey(request) ?? `order_approve:${orderId}`

    const result = await withIdempotency<Record<string, unknown>>(idempKey, 'order_approve', async () => {
      // Transactional activation: order → paid, subscription extended, role updated.
      // Commission distribution happens AFTER this tx (distributeCommission has its own tx + idempotency).
      const activated = await prisma.$transaction(
        async (tx) => {
          const order = await tx.order.findUnique({
            where: { id: orderId },
            include: {
              partner: true,
              user: { select: { id: true, email: true, name: true } },
            },
          })

          if (!order) {
            return { kind: 'error' as const, error: 'ไม่พบออเดอร์', status: 404 }
          }

          // Idempotent inside: if already PAID, return success without side-effects.
          if (order.status === 'PAID') {
            return {
              kind: 'already_paid' as const,
              orderId,
              orderType: order.orderType,
              userId: order.userId,
              orderNumber: order.orderNumber,
              userEmail: order.user.email,
              finalAmount: order.finalAmount,
              isFirstPayment: order.isFirstPayment,
            }
          }

          if (order.status !== 'PENDING') {
            return {
              kind: 'error' as const,
              error: `ออเดอร์อยู่ในสถานะ ${order.status}`,
              status: 400,
            }
          }

          const now = new Date()

          // 1. Order → PAID
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'PAID', paidAt: now },
          })

          // 2. Activate subscription based on orderType
          if (order.orderType === 'PARTNER' && order.partnerId) {
            const endDate = new Date(now)
            endDate.setMonth(endDate.getMonth() + (order.partner?.durationMonths || 1))

            await tx.partner.update({
              where: { id: order.partnerId },
              data: { status: 'ACTIVE', startDate: now, endDate },
            })
            await tx.user.update({
              where: { id: order.userId },
              data: { role: 'PARTNER' },
            })
          } else if (order.orderType === 'SIGNAL') {
            const metadata = order.metadata as Record<string, unknown> | null
            const months = (metadata?.months as number) || 1
            const bonusMonths = (metadata?.bonus as number) || 0
            const totalMonths = months + bonusMonths

            const existingSignal = await tx.signalSubscription.findFirst({
              where: { userId: order.userId },
            })

            if (existingSignal) {
              const currentEnd =
                existingSignal.endDate && existingSignal.endDate > now
                  ? existingSignal.endDate
                  : now
              const newEndDate = new Date(currentEnd)
              newEndDate.setMonth(newEndDate.getMonth() + totalMonths)

              await tx.signalSubscription.update({
                where: { id: existingSignal.id },
                data: { status: 'ACTIVE', endDate: newEndDate },
              })
            } else {
              const endDate = new Date(now)
              endDate.setMonth(endDate.getMonth() + totalMonths)
              await tx.signalSubscription.create({
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

          return {
            kind: 'activated' as const,
            orderId,
            orderType: order.orderType,
            userId: order.userId,
            orderNumber: order.orderNumber,
            userEmail: order.user.email,
            finalAmount: order.finalAmount,
            isFirstPayment: order.isFirstPayment,
          }
        },
        {
          timeout: 20_000,
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )

      if (activated.kind === 'error') {
        return { statusCode: activated.status, body: { error: activated.error } }
      }

      const alreadyPaid = activated.kind === 'already_paid'

      // Distribute affiliate commission (outside activation tx — has its own safety)
      let affiliate = { distributed: 0, totalPool: 0, totalPaid: 0, dust: 0 }
      if (!alreadyPaid) {
        const affiliateOn = await isAffiliateEnabled()
        if (affiliateOn && activated.isFirstPayment) {
          try {
            const res = await distributeCommission(activated.orderId, activated.userId)
            affiliate = {
              distributed: res.distributed,
              totalPool: res.totalPool,
              totalPaid: res.totalPaid,
              dust: res.dust,
            }
          } catch (e) {
            // Commission distribution failure is logged but DOES NOT fail the order approve.
            // The order is already PAID and subscription activated; admin can retry distribution
            // manually if needed (affiliatePayment.orderId is UNIQUE so retries are safe).
            logger.error('Affiliate distribution failed (order approved anyway)', {
              context: 'affiliate',
              metadata: { orderId: activated.orderId },
              error: e instanceof Error ? e.message : String(e),
            })
          }
        }
      }

      logger.info(
        `Order approved: ${activated.orderNumber || activated.orderId} (${activated.orderType})`,
        {
          context: 'payment',
          userId: activated.userId,
          metadata: {
            orderId: activated.orderId,
            amount: activated.finalAmount,
            alreadyPaid,
            affiliateDistributed: affiliate.distributed,
          },
        },
      )

      return {
        statusCode: 200,
        body: {
          success: true,
          message: alreadyPaid ? 'ออเดอร์นี้อนุมัติแล้ว' : 'อนุมัติออเดอร์สำเร็จ',
          alreadyPaid,
          affiliate,
        },
      }
    })

    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    logger.error('Approve order error', { context: 'payment', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
