// lib/order-approve.ts
// Shared order activation logic — used by both admin approve endpoint and
// auto-approve (triggered automatically when EasySlip verifies a slip).

import { prisma } from '@/lib/prisma'
import { distributeCommission } from '@/lib/affiliate'
import { isAffiliateEnabled } from '@/lib/system-settings'
import { logger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

export type ApproveResult =
  | { kind: 'ok'; alreadyPaid: boolean }
  | { kind: 'not_found' }
  | { kind: 'wrong_status'; status: string }

/**
 * Activate an order: PENDING → PAID, extend subscription, distribute commission.
 * Idempotent — safe to call multiple times for the same orderId.
 */
export async function activateOrder(orderId: string): Promise<ApproveResult> {
  const activated = await prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { partner: true, user: { select: { id: true } } },
      })

      if (!order) return { kind: 'not_found' as const }

      if (order.status === 'PAID') {
        return {
          kind: 'already_paid' as const,
          userId: order.userId,
          orderType: order.orderType,
          isFirstPayment: order.isFirstPayment,
          metadata: order.metadata,
          finalAmount: order.finalAmount,
          partnerId: order.partnerId,
        }
      }

      if (order.status !== 'PENDING') {
        return { kind: 'wrong_status' as const, status: order.status }
      }

      const now = new Date()
      await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', paidAt: now } })

      if (order.orderType === 'PARTNER' && order.partnerId) {
        const endDate = new Date(now)
        endDate.setMonth(endDate.getMonth() + (order.partner?.durationMonths || 1))
        await tx.partner.update({
          where: { id: order.partnerId },
          data: { status: 'ACTIVE', startDate: now, endDate },
        })
        await tx.user.update({ where: { id: order.userId }, data: { role: 'PARTNER' } })
      } else if (order.orderType === 'SIGNAL') {
        const metadata = order.metadata as Record<string, unknown> | null
        const totalMonths = ((metadata?.months as number) || 1) + ((metadata?.bonus as number) || 0)

        const existing = await tx.signalSubscription.findFirst({ where: { userId: order.userId } })
        if (existing) {
          const base = existing.endDate && existing.endDate > now ? existing.endDate : now
          const newEnd = new Date(base)
          newEnd.setMonth(newEnd.getMonth() + totalMonths)
          await tx.signalSubscription.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE', endDate: newEnd },
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
        userId: order.userId,
        orderType: order.orderType,
        isFirstPayment: order.isFirstPayment,
        metadata: order.metadata,
        finalAmount: order.finalAmount,
        partnerId: order.partnerId,
      }
    },
    { timeout: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )

  if (activated.kind === 'not_found') return { kind: 'not_found' }
  if (activated.kind === 'wrong_status') return { kind: 'wrong_status', status: activated.status }

  const alreadyPaid = activated.kind === 'already_paid'

  if (!alreadyPaid && activated.kind === 'activated') {
    try {
      const affiliateOn = await isAffiliateEnabled()
      if (affiliateOn && activated.isFirstPayment) {
        await distributeCommission(orderId, activated.userId)
      }
    } catch (e) {
      logger.error('Affiliate distribution failed during auto-approve', {
        context: 'affiliate',
        metadata: { orderId },
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { kind: 'ok', alreadyPaid }
}
