// app/api/admin/withdrawals/[id]/reject/route.ts
// Admin rejects a PENDING withdrawal — releases held commissions and refunds ledger.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { sendWithdrawalRejectedEmail } from '@/lib/email'
import { rejectWithdrawal, WithdrawalError } from '@/lib/withdrawal'
import { getIdempotencyKey, withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const { reason } = await request.json()

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      return NextResponse.json(
        { error: 'กรุณาระบุเหตุผลในการปฏิเสธ' },
        { status: 400 },
      )
    }

    const idempKey = getIdempotencyKey(request) ?? `wd_reject:${id}`
    const actorIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const actorUa = request.headers.get('user-agent')

    const result = await withIdempotency(idempKey, 'withdraw_reject', async () => {
      await rejectWithdrawal({
        withdrawalId: id,
        actorId: admin?.id || 'system',
        actorRole: 'ADMIN',
        actorIp,
        actorUa,
        reason,
      })
      return { statusCode: 200, body: { success: true } }
    })

    // Notify user
    if (!result.cached) {
      try {
        const w = await prisma.withdrawal.findUnique({
          where: { id },
          include: { user: { select: { email: true, name: true } } },
        })
        if (w?.user?.email) {
          await sendWithdrawalRejectedEmail(w.user.email, {
            amount: w.amount / 100,
            bankCode: w.bankCode,
            accountNumber: w.accountNumber,
            accountName: w.accountName,
            date: w.createdAt,
            reason,
          })
        }
      } catch (emailError) {
        logger.error('Failed to send rejection email', { context: 'email', error: emailError })
      }
    }

    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    if (error instanceof WithdrawalError) {
      const code = error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status: code })
    }
    logger.error('Reject withdrawal error', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
