// lib/affiliate.ts
// Banking-grade affiliate commission engine.
//
// Model:
//   Pool        = floor(order.finalAmount × affiliate_pool_percent / 100)
//   weight(n)   = DECAY_RATE^(n-1)       where n = 1,2,3,... (1 = closest upline)
//   payment(n)  = floor(Pool × weight(n) / Σweights)
//   dust        = Pool - Σpayments       → credited to company (not to any upline)
//
// Rules enforced:
//   1. Atomicity: entire distribution is inside a single DB transaction.
//   2. Idempotency: AffiliatePayment.orderId is UNIQUE — retries are safe.
//   3. First-payment-only: (buyerId, uplineId) pair gets commission exactly once
//      (enforced by UNIQUE index — any duplicate simply skipped).
//   4. Every commission creates a matching LedgerEntry (COMMISSION_CREDIT).
//   5. Commissions are immutable (amount never updated — use split/reverse instead).
//
// USAGE: call distributeCommission(orderId, buyerId) only from ADMIN-APPROVE flow,
// never from public APIs.

import { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { postLedger } from './ledger'
import {
  AFFILIATE_DECAY_RATE,
  MAX_UPLINE_LEVELS,
  MIN_COMMISSION_SATANG,
  computePoolSatang,
} from './money'
import { getAffiliatePoolPercent } from './system-settings'
import { logger } from './logger'

// ============================================
// TYPES
// ============================================

interface UplineUser {
  id: string
  level: number // 1 = closest to buyer
}

interface CommissionResult {
  userId: string
  level: number
  weight: number
  normalizedWeight: number
  amount: number // satang
}

export interface DistributeResult {
  success: boolean
  alreadyDistributed: boolean
  distributed: number
  totalPool: number
  totalPaid: number
  dust: number
  commissions: CommissionResult[]
}

// ============================================
// GET UPLINE CHAIN (read-only — not transactional)
// ============================================

export async function getUplineChain(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<UplineUser[]> {
  const uplines: UplineUser[] = []
  const seen = new Set<string>([userId])
  let currentUserId = userId

  for (let level = 1; level <= MAX_UPLINE_LEVELS; level++) {
    const row = await client.user.findUnique({
      where: { id: currentUserId },
      select: { referredById: true },
    })
    if (!row?.referredById) break
    // Cycle guard: if somehow referral graph loops, stop.
    if (seen.has(row.referredById)) break
    seen.add(row.referredById)

    uplines.push({ id: row.referredById, level })
    currentUserId = row.referredById
  }

  return uplines
}

// ============================================
// PURE: calculate payments from pool + uplines
// ============================================

export function calculateCommissions(
  uplines: UplineUser[],
  poolSatang: number,
): { commissions: CommissionResult[]; totalPaid: number; dust: number } {
  if (uplines.length === 0 || poolSatang <= 0) {
    return { commissions: [], totalPaid: 0, dust: poolSatang > 0 ? poolSatang : 0 }
  }

  const weights = uplines.map((u) => ({
    ...u,
    weight: Math.pow(AFFILIATE_DECAY_RATE, u.level - 1),
  }))
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0)

  const commissions: CommissionResult[] = weights.map((w) => {
    const amount = Math.floor((poolSatang * w.weight) / totalWeight)
    return {
      userId: w.id,
      level: w.level,
      weight: w.weight,
      normalizedWeight: w.weight / totalWeight,
      amount,
    }
  })

  // Drop commissions below MIN_COMMISSION_SATANG; their share becomes dust.
  const kept = commissions.filter((c) => c.amount >= MIN_COMMISSION_SATANG)
  const totalPaid = kept.reduce((s, c) => s + c.amount, 0)
  const dust = poolSatang - totalPaid

  return { commissions: kept, totalPaid, dust }
}

// ============================================
// DISTRIBUTE (transactional, idempotent)
// ============================================

export async function distributeCommission(
  orderId: string,
  buyerId: string,
): Promise<DistributeResult> {
  // 1. Load order + settings outside the transaction (read-only, cheap)
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      finalAmount: true,
      isFirstPayment: true,
      userId: true,
      affiliatePayment: { select: { id: true } },
    },
  })
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  if (order.userId !== buyerId) {
    throw new Error(`buyerId mismatch for order ${orderId}`)
  }
  // Idempotency check: already distributed.
  if (order.affiliatePayment) {
    logger.info(`[Affiliate] Order ${orderId} already distributed — skipping`, {
      context: 'affiliate',
    })
    return {
      success: true,
      alreadyDistributed: true,
      distributed: 0,
      totalPool: 0,
      totalPaid: 0,
      dust: 0,
      commissions: [],
    }
  }
  // First-payment-only guard (for recurring VIP subscriptions)
  if (!order.isFirstPayment) {
    logger.info(`[Affiliate] Order ${orderId} is not first payment — skipping`, {
      context: 'affiliate',
    })
    return {
      success: true,
      alreadyDistributed: false,
      distributed: 0,
      totalPool: 0,
      totalPaid: 0,
      dust: 0,
      commissions: [],
    }
  }

  // Read % from system settings (per-call, not cached here — settings lib caches 60s)
  const percent = await getAffiliatePoolPercent()
  const poolSatang = computePoolSatang(order.finalAmount, percent)

  if (poolSatang <= 0) {
    // Affiliate disabled or 0% — still mark as processed to avoid re-runs.
    return {
      success: true,
      alreadyDistributed: false,
      distributed: 0,
      totalPool: 0,
      totalPaid: 0,
      dust: 0,
      commissions: [],
    }
  }

  // 2. Build upline chain (read-only, outside tx for speed)
  const uplines = await getUplineChain(buyerId)
  if (uplines.length === 0) {
    // No uplines — entire pool is dust (company keeps it).
    logger.info(`[Affiliate] No upline for ${buyerId} — pool=${poolSatang} becomes dust`, {
      context: 'affiliate',
    })
    // Still record AffiliatePayment so idempotency kicks in on retry.
    try {
      await prisma.affiliatePayment.create({
        data: {
          orderId,
          totalPool: poolSatang,
          decayRate: AFFILIATE_DECAY_RATE,
          totalLevels: 0,
          totalWeight: 0,
          status: 'COMPLETED',
          distributedAt: new Date(),
          toCompany: true,
        },
      })
    } catch (e) {
      // Unique violation on orderId — already exists, fine.
      if (!isUniqueViolation(e)) throw e
    }
    return {
      success: true,
      alreadyDistributed: false,
      distributed: 0,
      totalPool: poolSatang,
      totalPaid: 0,
      dust: poolSatang,
      commissions: [],
    }
  }

  const { commissions, totalPaid, dust } = calculateCommissions(uplines, poolSatang)
  const totalWeight = commissions.reduce((s, c) => s + c.weight, 0)

  // 3. Atomic write
  try {
    await prisma.$transaction(
      async (tx) => {
        const payment = await tx.affiliatePayment.create({
          data: {
            orderId,
            totalPool: poolSatang,
            decayRate: AFFILIATE_DECAY_RATE,
            totalLevels: commissions.length,
            totalWeight,
            status: 'COMPLETED',
            distributedAt: new Date(),
            toCompany: dust > 0,
          },
        })

        for (const c of commissions) {
          // First-payment rule: skip if (buyerId, userId) already exists.
          // The unique index guards us even under race conditions.
          try {
            const commission = await tx.commission.create({
              data: {
                affiliatePaymentId: payment.id,
                buyerId,
                userId: c.userId,
                level: c.level,
                weight: c.weight,
                normalizedWeight: c.normalizedWeight,
                amount: c.amount,
                amountBaht: c.amount / 100,
                status: 'AVAILABLE',
              },
            })
            // Credit the ledger (immutable)
            await postLedger(tx, {
              userId: c.userId,
              amount: c.amount,
              type: 'COMMISSION_CREDIT',
              refType: 'commission',
              refId: commission.id,
              note: `Order ${orderId} level ${c.level}`,
            })
          } catch (e) {
            if (isUniqueViolation(e)) {
              // (buyerId, userId) already has a commission — skip.
              logger.info(
                `[Affiliate] Skip duplicate pair buyer=${buyerId} upline=${c.userId}`,
                { context: 'affiliate' },
              )
              continue
            }
            throw e
          }
        }
      },
      { timeout: 15_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (e) {
    if (isUniqueViolation(e)) {
      // AffiliatePayment.orderId collision — another request won. Treat as idempotent success.
      return {
        success: true,
        alreadyDistributed: true,
        distributed: 0,
        totalPool: poolSatang,
        totalPaid: 0,
        dust: 0,
        commissions: [],
      }
    }
    logger.error(`[Affiliate] Distribution failed for order ${orderId}`, {
      context: 'affiliate',
      error: e instanceof Error ? e.message : String(e),
    })
    throw e
  }

  logger.info(
    `[Affiliate] Distributed ${commissions.length} commissions for order ${orderId}, pool=${poolSatang} paid=${totalPaid} dust=${dust}`,
    { context: 'affiliate' },
  )

  return {
    success: true,
    alreadyDistributed: false,
    distributed: commissions.length,
    totalPool: poolSatang,
    totalPaid,
    dust,
    commissions,
  }
}

// ============================================
// HELPERS
// ============================================

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === 'P2002'
  )
}

/** Canonical user balance — read from ledger. */
export async function getUserAffiliateBalance(userId: string): Promise<number> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}

/** Total lifetime earned by user (sum of COMMISSION_CREDIT only). */
export async function getUserLifetimeEarnings(userId: string): Promise<number> {
  const agg = await prisma.ledgerEntry.aggregate({
    where: { userId, type: 'COMMISSION_CREDIT' },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}
