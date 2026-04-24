// lib/withdrawal.ts
// Banking-grade withdrawal state machine.
//
// State transitions:
//   PENDING → APPROVED    (admin approves request, balance still held)
//   PENDING → REJECTED    (admin rejects, holds released)
//   APPROVED → PAID       (admin marks paid after bank transfer, commissions WITHDRAWN)
//   APPROVED → REJECTED   (NOT ALLOWED — must refund manually if already paid)
//
// Rules:
//   - Balance comes from LedgerEntry (SUM).
//   - Creating a withdrawal posts WITHDRAWAL_HOLD (-amount) and reserves commissions
//     (AVAILABLE → HOLDING) FIFO, splitting the last commission if needed.
//   - Rejecting posts WITHDRAWAL_RELEASE (+amount) and returns commissions to AVAILABLE
//     (split children re-merged by marking parent AVAILABLE + voiding children).
//   - Marking paid posts WITHDRAWAL_DEBIT (0 marker) and flips commissions HOLDING → WITHDRAWN.
//   - Every transition writes a WithdrawalAudit row.
//   - Transactions use Serializable isolation to prevent double-spend.

import { Prisma, WithdrawalStatus } from '@prisma/client'
import { prisma } from './prisma'
import { postLedger, getAvailableForWithdraw } from './ledger'
import { getMinWithdrawSatang } from './system-settings'
import { logger } from './logger'

export interface CreateWithdrawalInput {
  userId: string
  partnerId: string
  amountSatang: number
  bankCode: string
  accountNumber: string
  accountName: string
  phone: string
  actorIp?: string | null
  actorUa?: string | null
}

export interface WithdrawalTransitionInput {
  withdrawalId: string
  actorId: string
  actorRole: 'ADMIN' | 'USER' | 'SYSTEM'
  actorIp?: string | null
  actorUa?: string | null
  reason?: string | null
  paymentRef?: string | null
}

// ============================================
// CREATE (user-initiated)
// ============================================

export async function createWithdrawal(input: CreateWithdrawalInput) {
  const min = await getMinWithdrawSatang()

  if (!Number.isInteger(input.amountSatang) || input.amountSatang <= 0) {
    throw new WithdrawalError('INVALID_AMOUNT', 'จำนวนไม่ถูกต้อง')
  }
  if (input.amountSatang < min) {
    throw new WithdrawalError(
      'BELOW_MIN',
      `ขั้นต่ำในการถอนคือ ฿${(min / 100).toLocaleString()}`,
    )
  }

  return prisma.$transaction(
    async (tx) => {
      // 1. Lock user balance — serializable isolation is the primary guard,
      //    but we also re-check balance inside the tx.
      const available = await getAvailableForWithdraw(input.userId, tx)
      if (available < input.amountSatang) {
        throw new WithdrawalError(
          'INSUFFICIENT_BALANCE',
          `ยอดเงินไม่เพียงพอ (มี ${available}, ขอถอน ${input.amountSatang})`,
        )
      }

      // 2. Create Withdrawal row (status=PENDING)
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: input.userId,
          partnerId: input.partnerId,
          amount: input.amountSatang,
          amountBaht: input.amountSatang / 100,
          bankCode: input.bankCode,
          accountNumber: input.accountNumber,
          accountName: input.accountName,
          phone: input.phone,
          status: 'PENDING',
        },
      })

      // 3. Reserve commissions FIFO (AVAILABLE → HOLDING), split last if needed
      await reserveCommissions(tx, input.userId, input.amountSatang, withdrawal.id)

      // 4. Post WITHDRAWAL_HOLD (-amount) to ledger
      await postLedger(tx, {
        userId: input.userId,
        amount: -input.amountSatang,
        type: 'WITHDRAWAL_HOLD',
        refType: 'withdrawal',
        refId: withdrawal.id,
        withdrawalId: withdrawal.id,
        note: 'User requested withdrawal',
      })

      // 5. Audit
      await tx.withdrawalAudit.create({
        data: {
          withdrawalId: withdrawal.id,
          fromStatus: null,
          toStatus: 'PENDING',
          actorId: input.userId,
          actorRole: 'USER',
          actorIp: input.actorIp ?? null,
          actorUa: input.actorUa ?? null,
          reason: 'Withdrawal requested',
        },
      })

      return withdrawal
    },
    {
      timeout: 15_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  )
}

// ============================================
// APPROVE (admin)
// ============================================

export async function approveWithdrawal(input: WithdrawalTransitionInput) {
  return transitionStatus(input, 'PENDING', 'APPROVED', async () => {})
}

// ============================================
// MARK PAID (admin, after actual bank transfer)
// ============================================

export async function markWithdrawalPaid(input: WithdrawalTransitionInput) {
  return transitionStatus(input, 'APPROVED', 'PAID', async (tx, withdrawal) => {
    // Flip HOLDING → WITHDRAWN for all commissions linked to this withdrawal
    await tx.commission.updateMany({
      where: { withdrawalId: withdrawal.id, status: 'HOLDING' },
      data: {
        status: 'WITHDRAWN',
        paidAt: new Date(),
        paidVia: 'WITHDRAWAL',
      },
    })
    // Payment ref on withdrawal
    if (input.paymentRef) {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { paymentRef: input.paymentRef, paidAt: new Date() },
      })
    } else {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { paidAt: new Date() },
      })
    }
    // Post zero-amount marker entry (hold was already the debit)
    await postLedger(tx, {
      userId: withdrawal.userId,
      amount: 0,
      type: 'WITHDRAWAL_DEBIT',
      refType: 'withdrawal',
      refId: withdrawal.id,
      withdrawalId: withdrawal.id,
      note: `Paid via bank. ref=${input.paymentRef ?? '-'}`,
      createdBy: input.actorId,
    })
  })
}

// ============================================
// REJECT (admin)
// ============================================

export async function rejectWithdrawal(input: WithdrawalTransitionInput) {
  if (!input.reason || input.reason.trim() === '') {
    throw new WithdrawalError('REASON_REQUIRED', 'กรุณาระบุเหตุผล')
  }
  return transitionStatus(input, 'PENDING', 'REJECTED', async (tx, withdrawal) => {
    // Release reserved commissions
    await releaseCommissions(tx, withdrawal.id)
    // Update rejection fields
    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        rejectedBy: input.actorId,
        rejectedAt: new Date(),
        rejectedReason: input.reason,
      },
    })
    // Refund hold via ledger
    await postLedger(tx, {
      userId: withdrawal.userId,
      amount: withdrawal.amount,
      type: 'WITHDRAWAL_RELEASE',
      refType: 'withdrawal',
      refId: withdrawal.id,
      withdrawalId: withdrawal.id,
      note: `Rejected: ${input.reason}`,
      createdBy: input.actorId,
    })
  })
}

// ============================================
// INTERNAL: state machine helper
// ============================================

type TransitionCallback = (
  tx: Prisma.TransactionClient,
  withdrawal: { id: string; userId: string; amount: number; status: WithdrawalStatus },
) => Promise<void>

async function transitionStatus(
  input: WithdrawalTransitionInput,
  expectedFrom: WithdrawalStatus,
  to: WithdrawalStatus,
  inside: TransitionCallback,
) {
  return prisma.$transaction(
    async (tx) => {
      const w = await tx.withdrawal.findUnique({
        where: { id: input.withdrawalId },
        select: { id: true, userId: true, amount: true, status: true },
      })
      if (!w) throw new WithdrawalError('NOT_FOUND', 'ไม่พบรายการถอน')
      if (w.status !== expectedFrom) {
        throw new WithdrawalError(
          'INVALID_STATE',
          `สถานะปัจจุบัน ${w.status} ไม่สามารถเปลี่ยนเป็น ${to}`,
        )
      }

      // Apply inside-transaction side effects (commissions, ledger, update fields)
      await inside(tx, w)

      // Status transition
      const fromStatus = w.status
      await tx.withdrawal.update({
        where: { id: w.id },
        data: {
          status: to,
          ...(to === 'APPROVED'
            ? { approvedBy: input.actorId, approvedAt: new Date() }
            : {}),
        },
      })

      // Audit row
      await tx.withdrawalAudit.create({
        data: {
          withdrawalId: w.id,
          fromStatus,
          toStatus: to,
          actorId: input.actorId,
          actorRole: input.actorRole,
          actorIp: input.actorIp ?? null,
          actorUa: input.actorUa ?? null,
          reason: input.reason ?? null,
          metadata: input.paymentRef ? { paymentRef: input.paymentRef } : undefined,
        },
      })

      return { id: w.id, fromStatus, toStatus: to }
    },
    {
      timeout: 15_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  )
}

// ============================================
// INTERNAL: commission reservation (FIFO + split)
// ============================================

async function reserveCommissions(
  tx: Prisma.TransactionClient,
  userId: string,
  amountSatang: number,
  withdrawalId: string,
): Promise<void> {
  let remaining = amountSatang

  // FIFO: oldest AVAILABLE commissions first
  const commissions = await tx.commission.findMany({
    where: { userId, status: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
  })

  for (const c of commissions) {
    if (remaining <= 0) break
    if (c.amount <= remaining) {
      // Consume fully
      await tx.commission.update({
        where: { id: c.id },
        data: { status: 'HOLDING', withdrawalId },
      })
      remaining -= c.amount
    } else {
      // Split: consumed portion → HOLDING child, leftover → AVAILABLE child, parent → SPLIT
      await tx.commission.create({
        data: {
          affiliatePaymentId: c.affiliatePaymentId,
          buyerId: c.buyerId,
          userId: c.userId,
          level: c.level,
          weight: c.weight,
          normalizedWeight: c.normalizedWeight,
          amount: remaining,
          amountBaht: remaining / 100,
          status: 'HOLDING',
          withdrawalId,
          parentCommissionId: c.id,
        },
      })
      const leftover = c.amount - remaining
      await tx.commission.create({
        data: {
          affiliatePaymentId: c.affiliatePaymentId,
          buyerId: c.buyerId,
          userId: c.userId,
          level: c.level,
          weight: c.weight,
          normalizedWeight: c.normalizedWeight,
          amount: leftover,
          amountBaht: leftover / 100,
          status: 'AVAILABLE',
          parentCommissionId: c.id,
        },
      })
      // Void the parent — replaced by the two children
      await tx.commission.update({
        where: { id: c.id },
        data: { status: 'SPLIT' },
      })
      remaining = 0
    }
  }

  if (remaining > 0) {
    // This should NEVER happen if balance check above was correct.
    // Serializable + pre-check should prevent it, but we fail-safe.
    throw new WithdrawalError(
      'RESERVATION_FAILED',
      `คำนวณยอดถอนผิดพลาด (เหลือ ${remaining}) — กรุณาลองใหม่`,
    )
  }
}

async function releaseCommissions(
  tx: Prisma.TransactionClient,
  withdrawalId: string,
): Promise<void> {
  // Find all HOLDING commissions linked to this withdrawal
  const held = await tx.commission.findMany({
    where: { withdrawalId, status: 'HOLDING' },
  })

  for (const c of held) {
    if (c.parentCommissionId) {
      // Child from a split — release its share back to leftover sibling by
      // creating a new AVAILABLE with the consumed amount, and void this child.
      // Then mark parent as AVAILABLE again (the leftover sibling also needs merging).
      //
      // Simpler scheme used here: mark child as VOID, and the leftover sibling stays
      // AVAILABLE. Create a new AVAILABLE commission for the released portion so
      // total available is preserved.
      await tx.commission.update({
        where: { id: c.id },
        data: { status: 'VOID', withdrawalId: null },
      })
      await tx.commission.create({
        data: {
          affiliatePaymentId: c.affiliatePaymentId,
          buyerId: c.buyerId,
          userId: c.userId,
          level: c.level,
          weight: c.weight,
          normalizedWeight: c.normalizedWeight,
          amount: c.amount,
          amountBaht: c.amount / 100,
          status: 'AVAILABLE',
          parentCommissionId: c.parentCommissionId,
        },
      })
    } else {
      // Original commission — flip back to AVAILABLE
      await tx.commission.update({
        where: { id: c.id },
        data: { status: 'AVAILABLE', withdrawalId: null },
      })
    }
  }

  logger.info(`[Withdrawal] Released ${held.length} commissions for withdrawal ${withdrawalId}`, {
    context: 'withdrawal',
  })
}

// ============================================
// ERRORS
// ============================================

export class WithdrawalError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'INVALID_STATE'
      | 'INVALID_AMOUNT'
      | 'BELOW_MIN'
      | 'INSUFFICIENT_BALANCE'
      | 'RESERVATION_FAILED'
      | 'REASON_REQUIRED',
    message: string,
  ) {
    super(message)
    this.name = 'WithdrawalError'
  }
}
