// lib/affiliate.ts
// Banking-grade affiliate commission engine — recurring model with monthly cap.
//
// Model:
//   Pool        = floor(order.finalAmount × affiliate_pool_percent / 100)
//   weight(n)   = DECAY_RATE^(n-1)       where n = 1,2,3,... (1 = closest upline)
//   payment(n)  = floor(Pool × weight(n) / Σweights)
//   dust        = Pool - Σpayments       → credited to company (not to any upline)
//
// Monthly Cap with Overflow:
//   Each upline is capped at MONTHLY_COMMISSION_CAP_SATANG per calendar month.
//   When an upline hits the cap, their excess share redistributes proportionally
//   to other uplines in the chain who haven't reached their cap.
//   If ALL uplines are capped, overflow becomes dust (company keeps it).
//
// Rules enforced:
//   1. Atomicity: entire distribution is inside a single DB transaction.
//   2. Idempotency: AffiliatePayment.orderId is UNIQUE — retries are safe.
//   3. Recurring: commission on EVERY purchase (no first-payment-only guard).
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
  MONTHLY_COMMISSION_CAP_SATANG,
  computePoolSatang,
} from './money'
import { getAffiliatePoolPercent } from './system-settings'
import { sendCommissionCapEmail } from './email'
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
  wasCapped: boolean
  rawAmount: number // satang — amount before cap was applied
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
// MONTHLY EARNINGS QUERY
// ============================================

async function getMonthlyEarnings(
  userIds: string[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const rows = await client.ledgerEntry.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      type: 'COMMISSION_CREDIT',
      createdAt: { gte: monthStart },
    },
    _sum: { amount: true },
  })

  const map = new Map<string, number>()
  for (const row of rows) {
    map.set(row.userId, row._sum.amount ?? 0)
  }
  return map
}

// ============================================
// PURE: calculate payments with monthly cap + overflow
// ============================================

export function calculateCommissions(
  uplines: UplineUser[],
  poolSatang: number,
  monthlyEarnings?: Map<string, number>,
): { commissions: CommissionResult[]; totalPaid: number; dust: number } {
  if (uplines.length === 0 || poolSatang <= 0) {
    return { commissions: [], totalPaid: 0, dust: poolSatang > 0 ? poolSatang : 0 }
  }

  const earnings = monthlyEarnings ?? new Map<string, number>()

  // Phase 1: compute raw weighted amounts
  const weights = uplines.map((u) => ({
    ...u,
    weight: Math.pow(AFFILIATE_DECAY_RATE, u.level - 1),
  }))
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0)

  const rawAmounts = weights.map((w) => ({
    ...w,
    rawAmount: Math.floor((poolSatang * w.weight) / totalWeight),
    normalizedWeight: w.weight / totalWeight,
  }))

  // Phase 2: apply monthly cap with overflow redistribution
  // Iterative: capped uplines' excess gets redistributed to uncapped ones.
  // Repeat until no overflow remains or all uplines are capped.
  let remaining = rawAmounts.map((r) => ({
    ...r,
    amount: r.rawAmount,
    capped: false,
  }))

  for (let iteration = 0; iteration < uplines.length; iteration++) {
    let overflow = 0
    let uncappedWeight = 0

    for (const entry of remaining) {
      if (entry.capped) continue
      const currentMonthly = earnings.get(entry.id) ?? 0
      const headroom = Math.max(0, MONTHLY_COMMISSION_CAP_SATANG - currentMonthly)

      if (entry.amount > headroom) {
        overflow += entry.amount - headroom
        entry.amount = headroom
        entry.capped = true
      } else {
        uncappedWeight += entry.weight
      }
    }

    if (overflow === 0 || uncappedWeight === 0) break

    // Redistribute overflow proportionally among uncapped uplines
    let distributed = 0
    const uncapped = remaining.filter((e) => !e.capped)
    for (let i = 0; i < uncapped.length; i++) {
      const entry = uncapped[i]
      const share =
        i === uncapped.length - 1
          ? overflow - distributed // last one gets remainder to avoid rounding loss
          : Math.floor((overflow * entry.weight) / uncappedWeight)
      entry.amount += share
      distributed += share
    }
  }

  // Phase 3: drop below minimum, compute totals
  const kept = remaining
    .filter((c) => c.amount >= MIN_COMMISSION_SATANG)
    .map((c) => ({
      userId: c.id,
      level: c.level,
      weight: c.weight,
      normalizedWeight: c.normalizedWeight,
      amount: c.amount,
      wasCapped: c.capped,
      rawAmount: c.rawAmount,
    }))

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

  // Read % from system settings (per-call, not cached here — settings lib caches 60s)
  const percent = await getAffiliatePoolPercent()
  const poolSatang = computePoolSatang(order.finalAmount, percent)

  if (poolSatang <= 0) {
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
  const uplines = (await getUplineChain(buyerId))
    .filter((u) => u.id !== buyerId) // prevent self-commission
  if (uplines.length === 0) {
    logger.info(`[Affiliate] No upline for ${buyerId} — pool=${poolSatang} becomes dust`, {
      context: 'affiliate',
    })
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

  // 3. Fetch monthly earnings for cap enforcement
  const monthlyEarnings = await getMonthlyEarnings(uplines.map((u) => u.id))

  const { commissions, totalPaid, dust } = calculateCommissions(uplines, poolSatang, monthlyEarnings)
  const totalWeight = commissions.reduce((s, c) => s + c.weight, 0)

  // 4. Atomic write
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
              // (affiliatePaymentId, userId) already has a commission — skip.
              logger.info(
                `[Affiliate] Skip duplicate commission for order payment=${payment.id} upline=${c.userId}`,
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

  // 5. Fire-and-forget cap notifications (outside transaction — non-critical)
  notifyCapReached(commissions, monthlyEarnings).catch(() => {})

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
// CAP NOTIFICATIONS (fire-and-forget)
// ============================================

const CAP_NOTIFY_THRESHOLD = 0.8 // notify at 80%+

async function notifyCapReached(
  commissions: CommissionResult[],
  monthlyEarningsBefore: Map<string, number>,
): Promise<void> {
  const candidateIds = commissions
    .filter((c) => {
      const before = monthlyEarningsBefore.get(c.userId) ?? 0
      const after = before + c.amount
      const ratio = after / MONTHLY_COMMISSION_CAP_SATANG
      return ratio >= CAP_NOTIFY_THRESHOLD || c.wasCapped
    })
    .map((c) => c.userId)

  if (candidateIds.length === 0) return

  const users = await prisma.user.findMany({
    where: { id: { in: candidateIds } },
    select: { id: true, email: true },
  })
  const emailMap = new Map(users.map((u) => [u.id, u.email]))

  await Promise.allSettled(
    commissions
      .filter((c) => emailMap.has(c.userId))
      .map((c) => {
        const email = emailMap.get(c.userId)
        if (!email) return Promise.resolve()
        const before = monthlyEarningsBefore.get(c.userId) ?? 0
        const after = before + c.amount
        const ratio = after / MONTHLY_COMMISSION_CAP_SATANG
        if (ratio < CAP_NOTIFY_THRESHOLD && !c.wasCapped) return Promise.resolve()

        return sendCommissionCapEmail(email, {
          monthlyEarned: after,
          monthlyCap: MONTHLY_COMMISSION_CAP_SATANG,
          commissionAmount: c.amount,
          wasCapped: c.wasCapped,
          originalAmount: c.wasCapped ? c.rawAmount : undefined,
        })
      }),
  )
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
