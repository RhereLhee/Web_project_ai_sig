// app/api/admin/withdrawals/[id]/paid/route.ts
// Mark as PAID after the actual bank transfer has been executed.
// Flips linked commissions HOLDING → WITHDRAWN and writes a zero-amount ledger marker.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { sendWithdrawalPaidEmail } from '@/lib/email'
import { markWithdrawalPaid, WithdrawalError } from '@/lib/withdrawal'
import { getIdempotencyKey, withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    let paymentRef: string | undefined
    try {
      const body = await request.json()
      paymentRef = body.paymentRef
    } catch {
      // optional
    }

    const idempKey = getIdempotencyKey(request) ?? `wd_paid:${id}`
    const actorIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const actorUa = request.headers.get('user-agent')

    const result = await withIdempotency(idempKey, 'withdraw_paid', async () => {
      await markWithdrawalPaid({
        withdrawalId: id,
        actorId: admin?.id || 'system',
        actorRole: 'ADMIN',
        actorIp,
        actorUa,
        paymentRef: paymentRef ?? null,
      })
      return { statusCode: 200, body: { success: true } }
    })

    // Notification email (outside the cached response since it's a side-effect)
    if (!result.cached) {
      try {
        const w = await prisma.withdrawal.findUnique({
          where: { id },
          include: { user: { select: { email: true, name: true } } },
        })
        if (w?.user?.email) {
          await sendWithdrawalPaidEmail(w.user.email, {
            amount: w.amount / 100,
            bankCode: w.bankCode,
            accountNumber: w.accountNumber,
            accountName: w.accountName,
            date: w.paidAt ?? new Date(),
            paymentRef: w.paymentRef ?? undefined,
          })
        }
      } catch (emailError) {
        logger.error('Failed to send paid email', {
          context: 'email',
          error: emailError,
        })
      }
    }

    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    if (error instanceof WithdrawalError) {
      const code = error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status: code })
    }
    logger.error('Mark paid error', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
