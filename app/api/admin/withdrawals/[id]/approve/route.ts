// app/api/admin/withdrawals/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { approveWithdrawal, WithdrawalError } from '@/lib/withdrawal'
import { getIdempotencyKey, withIdempotency } from '@/lib/idempotency'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    // Admin cannot approve their own withdrawal — conflict of interest
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!withdrawal) {
      return NextResponse.json({ error: 'ไม่พบคำขอถอนเงิน' }, { status: 404 })
    }
    if (withdrawal.userId === admin?.id) {
      return NextResponse.json(
        { error: 'Admin ไม่สามารถอนุมัติคำขอถอนเงินของตัวเองได้' },
        { status: 403 },
      )
    }

    const idempKey = getIdempotencyKey(request) ?? `wd_approve:${id}:${admin?.id}`
    const actorIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const actorUa = request.headers.get('user-agent')

    const result = await withIdempotency(idempKey, 'withdraw_approve', async () => {
      const out = await approveWithdrawal({
        withdrawalId: id,
        actorId: admin?.id || 'system',
        actorRole: 'ADMIN',
        actorIp,
        actorUa,
      })
      return { statusCode: 200, body: { success: true, ...out } }
    })

    return NextResponse.json(result.body, { status: result.statusCode })
  } catch (error) {
    if (error instanceof WithdrawalError) {
      const code = error.code === 'NOT_FOUND' ? 404 : 400
      return NextResponse.json({ error: error.message, code: error.code }, { status: code })
    }
    logger.error('Approve withdrawal error', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
