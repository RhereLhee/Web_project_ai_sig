// app/api/cron/payout-reminder/route.ts
// Bi-weekly payout reminder — runs every Sunday.
// Emails every admin user a summary of PENDING + APPROVED withdrawals so they know
// to run the bank batch. Does NOT modify any data.
//
// Schedule (Vercel cron example, vercel.json):
//   { "path": "/api/cron/payout-reminder", "schedule": "0 9 * * 0" }  // 09:00 UTC Sunday
//
// Idempotent: calling multiple times in the same day just sends the same email again.
// Wire to a GET so Vercel Cron can call it with a simple bearer.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { authenticateCron } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

async function run() {
  // Pull all PENDING + APPROVED withdrawals (the ones that still need admin action).
  const rows = await prisma.withdrawal.findMany({
    where: { status: { in: ['PENDING', 'APPROVED'] } },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const pendingCount = rows.filter((r) => r.status === 'PENDING').length
  const approvedCount = rows.filter((r) => r.status === 'APPROVED').length
  const totalSatang = rows.reduce((s, r) => s + r.amount, 0)
  const approvedSatang = rows
    .filter((r) => r.status === 'APPROVED')
    .reduce((s, r) => s + r.amount, 0)

  if (rows.length === 0) {
    return { sent: 0, reason: 'No pending/approved withdrawals' }
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, name: true },
  })
  if (admins.length === 0) {
    return { sent: 0, reason: 'No admin users' }
  }

  const rowsHtml = rows
    .slice(0, 50) // cap for email size
    .map(
      (r) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${r.withdrawalNumber}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.user.name || '-'}<br><span style="color:#888;font-size:11px">${r.user.email || ''}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;font-family:monospace">฿${formatBaht(r.amount)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.bankCode} · ${r.accountNumber}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;font-size:11px">${r.status}</td>
      </tr>`,
    )
    .join('')

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:720px;margin:0 auto;padding:20px">
      <h2 style="color:#111">สรุปคำขอถอนเงิน — ${new Date().toLocaleDateString('th-TH')}</h2>
      <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0">
          <strong>รอตรวจสอบ (PENDING):</strong> ${pendingCount} รายการ<br>
          <strong>อนุมัติแล้วรอโอน (APPROVED):</strong> ${approvedCount} รายการ — ฿${formatBaht(approvedSatang)}<br>
          <strong>ยอดรวม:</strong> ฿${formatBaht(totalSatang)}
        </p>
      </div>
      <p>กรุณา:</p>
      <ol>
        <li>ตรวจคำขอถอน PENDING และกดอนุมัติ/ปฏิเสธ</li>
        <li>ดาวน์โหลด CSV ของ APPROVED แล้วนำเข้าธนาคารเพื่อโอน</li>
        <li>หลังโอนเสร็จ กด "โอนแล้ว" เพื่อปิดคำขอ</li>
      </ol>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="padding:8px;text-align:left">#</th>
            <th style="padding:8px;text-align:left">ผู้ขอ</th>
            <th style="padding:8px;text-align:right">ยอด</th>
            <th style="padding:8px;text-align:left">บัญชีรับ</th>
            <th style="padding:8px;text-align:left">สถานะ</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${rows.length > 50 ? `<p style="color:#888;font-size:12px;margin-top:8px">... และอีก ${rows.length - 50} รายการ</p>` : ''}
      <p style="margin-top:24px">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/admin/withdrawals"
           style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px">
          เปิดหน้าจัดการถอนเงิน
        </a>
      </p>
    </div>`

  let sent = 0
  for (const admin of admins) {
    if (!admin.email) continue
    const r = await sendEmail(
      admin.email,
      `[TechTrade] รอดำเนินการถอนเงิน ${rows.length} รายการ — ฿${formatBaht(totalSatang)}`,
      html,
    )
    if (r.success) sent++
  }

  return { sent, total: rows.length, pendingCount, approvedCount, totalSatang }
}

export async function GET(req: NextRequest) {
  const auth = authenticateCron(req)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 401 })
  }
  try {
    const result = await run()
    logger.info('Payout reminder cron executed', { context: 'withdrawal', metadata: result })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    logger.error('Payout reminder cron failed', { context: 'withdrawal', error })
    return NextResponse.json({ error: 'cron failed' }, { status: 500 })
  }
}

// Allow POST as an alias so this can also be wired to any scheduler that prefers POST.
export const POST = GET
