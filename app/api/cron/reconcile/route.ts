// app/api/cron/reconcile/route.ts
// Daily reconciliation — detects drift between the three sources of truth that should agree:
//
//   (A) Commission AVAILABLE + HOLDING    — the "live" claim amount per user
//   (B) LedgerEntry SUM per user          — the authoritative balance
//
// Invariant:   (A) == (B)   for every user with any commission activity.
//
// If they disagree, something is wrong (e.g. a ledger entry was deleted despite the trigger,
// or a commission was updated despite the immutable rule). Email admins immediately.
//
// Schedule (vercel.json):
//   { "path": "/api/cron/reconcile", "schedule": "0 3 * * *" }   // 03:00 UTC daily

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { authenticateCron } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

interface Drift {
  userId: string
  email: string | null
  name: string | null
  claim: number // AVAILABLE + HOLDING
  ledger: number // SUM(LedgerEntry)
  diff: number // claim - ledger
}

function formatBaht(satang: number) {
  const sign = satang < 0 ? '-' : ''
  return `${sign}฿${(Math.abs(satang) / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

async function run(): Promise<{
  ok: boolean
  usersChecked: number
  drifts: Drift[]
}> {
  // Collect all userIds that have either a commission OR a ledger entry.
  const [commUsers, ledgerUsers] = await Promise.all([
    prisma.commission.findMany({
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.ledgerEntry.findMany({
      select: { userId: true },
      distinct: ['userId'],
    }),
  ])
  const userIds = Array.from(
    new Set([...commUsers.map((u) => u.userId), ...ledgerUsers.map((u) => u.userId)]),
  )

  const drifts: Drift[] = []

  // Check each user sequentially — keeps query simple and DB load modest.
  // If the user base grows past a few thousand active partners, parallelize in chunks.
  for (const userId of userIds) {
    const [claimAgg, ledgerAgg, userRow] = await Promise.all([
      prisma.commission.aggregate({
        where: { userId, status: { in: ['AVAILABLE', 'HOLDING'] } },
        _sum: { amount: true },
      }),
      prisma.ledgerEntry.aggregate({
        where: { userId },
        _sum: { amount: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      }),
    ])

    const claim = claimAgg._sum.amount ?? 0
    const ledger = ledgerAgg._sum.amount ?? 0
    const diff = claim - ledger

    if (diff !== 0) {
      drifts.push({
        userId,
        email: userRow?.email ?? null,
        name: userRow?.name ?? null,
        claim,
        ledger,
        diff,
      })
    }
  }

  if (drifts.length > 0) {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    })

    const rowsHtml = drifts
      .map(
        (d) => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px">${d.userId}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee">${d.name || '-'}<br><span style="color:#888;font-size:11px">${d.email || ''}</span></td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">${formatBaht(d.claim)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">${formatBaht(d.ledger)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace;color:#dc2626;font-weight:bold">${formatBaht(d.diff)}</td>
        </tr>`,
      )
      .join('')

    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:0 auto;padding:20px">
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:16px">
          <h2 style="color:#dc2626;margin:0">🚨 Ledger Reconciliation Drift</h2>
          <p style="margin:8px 0 0">
            พบ ${drifts.length} ผู้ใช้ที่ยอด commission (AVAILABLE+HOLDING) ไม่ตรงกับ ledger balance
            — ต้องตรวจสอบด่วน
          </p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f0f0f0">
              <th style="padding:8px;text-align:left">User ID</th>
              <th style="padding:8px;text-align:left">ผู้ใช้</th>
              <th style="padding:8px;text-align:right">Commission (A+H)</th>
              <th style="padding:8px;text-align:right">Ledger Balance</th>
              <th style="padding:8px;text-align:right">Diff</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="color:#888;font-size:12px;margin-top:16px">
          ค่า diff ที่เป็นบวก = user มี commission มากกว่ายอดที่ ledger บันทึก (ยังไม่ได้ CREDIT)<br>
          ค่า diff ที่เป็นลบ = ledger บันทึกมากกว่า commission ที่ยัง AVAILABLE/HOLDING (เช่น WITHDRAWN แต่ไม่ได้ DEBIT)
        </p>
      </div>`

    for (const admin of admins) {
      if (!admin.email) continue
      await sendEmail(admin.email, '[TechTrade] 🚨 Ledger Reconciliation Drift Detected', html)
    }
  }

  return { ok: drifts.length === 0, usersChecked: userIds.length, drifts }
}

export async function GET(req: NextRequest) {
  const auth = authenticateCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: 401 })
  try {
    const result = await run()
    if (!result.ok) {
      logger.error('Reconciliation drift detected', {
        context: 'affiliate',
        metadata: { driftCount: result.drifts.length, usersChecked: result.usersChecked },
      })
    } else {
      logger.info('Reconciliation clean', {
        context: 'affiliate',
        metadata: { usersChecked: result.usersChecked },
      })
    }
    return NextResponse.json(result)
  } catch (error) {
    logger.error('Reconciliation cron failed', { context: 'affiliate', error })
    return NextResponse.json({ error: 'cron failed' }, { status: 500 })
  }
}

export const POST = GET
