// lib/ledger.ts
// Immutable double-entry ledger helpers.
// RULE: balance(user) = SUM(LedgerEntry.amount WHERE userId=X)
// DO NOT update or delete LedgerEntry rows — DB trigger will reject.

import { LedgerType, Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface LedgerInsert {
  userId: string
  amount: number // signed satang (+ credit, - debit)
  type: LedgerType
  refType: 'commission' | 'withdrawal' | 'order' | 'adjustment'
  refId: string
  withdrawalId?: string | null
  note?: string | null
  createdBy?: string | null
}

/** Post an entry into the ledger. Must be called inside a Prisma transaction. */
export async function postLedger(
  tx: Prisma.TransactionClient,
  entry: LedgerInsert,
): Promise<void> {
  if (!Number.isInteger(entry.amount)) {
    throw new Error(`Ledger amount must be integer satang, got ${entry.amount}`)
  }
  if (entry.amount === 0) {
    // Allow zero-amount marker entries (e.g. WITHDRAWAL_DEBIT on PAID transition).
    // They are useful for audit trail but not for balance math.
  }
  await tx.ledgerEntry.create({
    data: {
      userId: entry.userId,
      amount: entry.amount,
      type: entry.type,
      refType: entry.refType,
      refId: entry.refId,
      withdrawalId: entry.withdrawalId ?? null,
      note: entry.note ?? null,
      createdBy: entry.createdBy ?? null,
    },
  })
}

/** Compute user balance strictly from ledger. Source of truth. */
export async function getLedgerBalance(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  const agg = await client.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amount: true },
  })
  return agg._sum.amount ?? 0
}

/** Compute available-for-withdraw = commissions credited - hold - released - debited
 *  This equals SUM(ledger) actually, since HOLD is negative and RELEASE is positive. */
export async function getAvailableForWithdraw(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  return getLedgerBalance(userId, client)
}
