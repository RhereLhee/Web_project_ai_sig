// app/api/admin/withdrawals/export/route.ts
// Admin-only CSV export of withdrawal batches.
// Intended for bi-weekly payout runs: filter by status (PENDING/APPROVED) and paste into bank portal.
//
// CSV spec:
//   - BOM-prefixed UTF-8 so Excel renders Thai correctly
//   - Comma-separated, double-quote-quoted; doubled quotes escape embedded quotes
//   - Columns: withdrawalNumber, createdAt, paidAt, status, userName, userEmail, userPhone,
//              bankCode, accountNumber, accountName, phone, amountBaht, amountSatang, paymentRef, rejectedReason
//   - Numeric amounts as plain integers / 2-decimal baht (no currency symbols)

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { WithdrawalStatus, Prisma } from '@prisma/client'

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatIsoThai(d: Date | null | undefined): string {
  if (!d) return ''
  // ISO-ish with seconds, no TZ — consistent for spreadsheet parsing
  return new Date(d)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, '')
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()

    const url = new URL(req.url)
    const status = url.searchParams.get('status') || 'ALL'
    const from = url.searchParams.get('from') // YYYY-MM-DD inclusive
    const to = url.searchParams.get('to') // YYYY-MM-DD exclusive

    const where: Prisma.WithdrawalWhereInput = {}
    if (status !== 'ALL') {
      // Validate enum to avoid string-injection into the query type
      const allowed = ['PENDING', 'APPROVED', 'PAID', 'REJECTED'] as const
      if (!(allowed as readonly string[]).includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
      }
      where.status = status as WithdrawalStatus
    }
    if (from || to) {
      where.createdAt = {}
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(`${from}T00:00:00.000Z`)
      if (to) (where.createdAt as Prisma.DateTimeFilter).lt = new Date(`${to}T00:00:00.000Z`)
    }

    const rows = await prisma.withdrawal.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    const header = [
      'withdrawalNumber',
      'createdAt',
      'paidAt',
      'status',
      'userName',
      'userEmail',
      'userPhone',
      'bankCode',
      'accountNumber',
      'accountName',
      'phone',
      'amountBaht',
      'amountSatang',
      'paymentRef',
      'rejectedReason',
    ]

    const lines: string[] = [header.join(',')]
    for (const w of rows) {
      lines.push(
        [
          csvEscape(w.withdrawalNumber),
          csvEscape(formatIsoThai(w.createdAt)),
          csvEscape(formatIsoThai(w.paidAt)),
          csvEscape(w.status),
          csvEscape(w.user.name ?? ''),
          csvEscape(w.user.email ?? ''),
          csvEscape(w.user.phone ?? ''),
          csvEscape(w.bankCode),
          csvEscape(w.accountNumber),
          csvEscape(w.accountName),
          csvEscape(w.phone),
          (w.amount / 100).toFixed(2),
          String(w.amount),
          csvEscape(w.paymentRef ?? ''),
          csvEscape(w.rejectedReason ?? ''),
        ].join(','),
      )
    }

    // UTF-8 BOM so Excel on Windows renders Thai correctly
    const body = '\uFEFF' + lines.join('\r\n') + '\r\n'

    const today = new Date().toISOString().slice(0, 10)
    const filename = `withdrawals_${status.toLowerCase()}_${today}.csv`

    logger.info('Withdrawal CSV exported', {
      context: 'withdrawal',
      metadata: { status, count: rows.length, from, to },
    })

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logger.error('Withdrawal CSV export failed', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
