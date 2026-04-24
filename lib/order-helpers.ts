// lib/order-helpers.ts
// Helpers for creating orders with unique-amount suffix and first-payment detection.

import { Prisma } from '@prisma/client'
import {
  generateAmountSuffix,
  ORDER_PAYMENT_TTL_MS,
  AMOUNT_SUFFIX_MAX,
} from './money'

/** Generate order payment fields:
 *   - amountSuffix: 1..99 satang (unique per outstanding PENDING orders for this base amount)
 *   - expectedAmountSatang: base + suffix
 *   - expiresAt: now + 30 min
 *
 * The suffix uniqueness is best-effort: we try up to 5 times to find a suffix not
 * in use by another PENDING order with the same base. Collision probability is
 * <1% under normal load, since we only need uniqueness within {base, ..base+99}
 * simultaneously-outstanding orders.
 */
export async function buildOrderPaymentFields(
  tx: Prisma.TransactionClient,
  baseAmountSatang: number,
): Promise<{
  amountSuffix: number
  expectedAmountSatang: number
  expiresAt: Date
}> {
  const attempts = 5
  const now = Date.now()

  for (let i = 0; i < attempts; i++) {
    const suffix = generateAmountSuffix()
    const expected = baseAmountSatang + suffix
    const collision = await tx.order.findFirst({
      where: {
        status: 'PENDING',
        expectedAmountSatang: expected,
        // Only care about not-yet-expired orders
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })
    if (!collision) {
      return {
        amountSuffix: suffix,
        expectedAmountSatang: expected,
        expiresAt: new Date(now + ORDER_PAYMENT_TTL_MS),
      }
    }
  }

  // Fallback: scan 1..99 deterministically for an unused suffix.
  for (let s = 1; s <= AMOUNT_SUFFIX_MAX; s++) {
    const expected = baseAmountSatang + s
    const collision = await tx.order.findFirst({
      where: {
        status: 'PENDING',
        expectedAmountSatang: expected,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    })
    if (!collision) {
      return {
        amountSuffix: s,
        expectedAmountSatang: expected,
        expiresAt: new Date(now + ORDER_PAYMENT_TTL_MS),
      }
    }
  }

  // All 99 suffixes in use — extremely unlikely. Fall back to no suffix with new TTL.
  return {
    amountSuffix: 0,
    expectedAmountSatang: baseAmountSatang,
    expiresAt: new Date(now + ORDER_PAYMENT_TTL_MS),
  }
}

/** Determine whether this is the buyer's first payment in an affiliate sense.
 *  Rule: first-ever PAID order → true (affiliate gets commission).
 *        subsequent renewals/re-purchases → false.
 */
export async function isFirstPaymentForBuyer(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<boolean> {
  const prior = await tx.order.findFirst({
    where: { userId, status: 'PAID' },
    select: { id: true },
  })
  return prior === null
}
