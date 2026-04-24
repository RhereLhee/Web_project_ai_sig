// app/admin/withdrawals/[id]/page.tsx
// Admin withdrawal detail — full audit trail + reserved commissions + ledger events.
// This page is the forensic record for one withdrawal.

import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WithdrawalActions } from '../WithdrawalActions'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  APPROVED: 'bg-blue-100 text-blue-700 border-blue-200',
  PAID: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว (รอโอน)',
  PAID: 'โอนแล้ว',
  REJECTED: 'ปฏิเสธ',
}

const COMMISSION_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700',
  HOLDING: 'bg-yellow-50 text-yellow-700',
  WITHDRAWN: 'bg-gray-100 text-gray-700',
  VOID: 'bg-red-50 text-red-700',
}

const LEDGER_TYPE_LABEL: Record<string, string> = {
  COMMISSION_CREDIT: 'รับ Commission',
  WITHDRAWAL_HOLD: 'กันยอดถอน',
  WITHDRAWAL_RELEASE: 'คืนยอด (ถูกปฏิเสธ)',
  WITHDRAWAL_DEBIT: 'จ่ายออก (PAID)',
  COMMISSION_REVERSAL: 'ยกเลิก Commission',
  ADJUSTMENT: 'ปรับยอด manual',
}

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(d: Date | null | undefined) {
  if (!d) return '-'
  return new Date(d).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default async function WithdrawalDetailPage({ params }: Props) {
  const { id } = await params

  const w = await prisma.withdrawal.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, role: true } },
      partner: {
        select: {
          id: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
          withdrawPhone: true,
          withdrawPhoneLockedAt: true,
        },
      },
      commissions: {
        include: {
          affiliatePayment: {
            select: {
              orderId: true,
              order: { select: { orderNumber: true } },
            },
          },
          parentCommission: { select: { id: true, amount: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      audits: {
        orderBy: { createdAt: 'asc' },
      },
      ledgerEntries: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!w) return notFound()

  const actorIds = Array.from(
    new Set(w.audits.map((a) => a.actorId).filter((x): x is string => !!x)),
  )
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      })
    : []
  const actorById = new Map(actors.map((a) => [a.id, a]))

  const totalCommissionSatang = w.commissions.reduce((s, c) => s + c.amount, 0)
  const ledgerBalance = w.ledgerEntries.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/withdrawals" className="hover:text-gray-900">
          ← ถอนเงิน
        </Link>
        <span>/</span>
        <span className="font-mono text-gray-700">{w.withdrawalNumber}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 font-mono">{w.withdrawalNumber}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              ฿{formatBaht(w.amount)}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              ผู้ขอ: <span className="font-medium">{w.user.name || '-'}</span>{' '}
              <span className="text-gray-400">({w.user.email})</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              ยื่นเมื่อ {formatDateTime(w.createdAt)}
            </p>
          </div>

          <div className="flex items-start gap-3">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${STATUS_COLOR[w.status] || ''}`}
            >
              {STATUS_LABEL[w.status] || w.status}
            </span>
            {w.status === 'PENDING' && <WithdrawalActions withdrawalId={w.id} />}
            {w.status === 'APPROVED' && <WithdrawalActions withdrawalId={w.id} showPaid />}
          </div>
        </div>

        {/* Quick facts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">บัญชีรับเงิน</p>
            <p className="font-medium text-gray-900">{w.bankCode}</p>
            <p className="font-mono text-sm text-gray-700">{w.accountNumber}</p>
            <p className="text-sm text-gray-500">{w.accountName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">เบอร์โทร</p>
            <p className="font-mono text-sm text-gray-900">{w.phone}</p>
            {w.partner?.withdrawPhoneLockedAt && (
              <p className="text-xs text-gray-500 mt-1">
                ล็อกเมื่อ {formatDateTime(w.partner.withdrawPhoneLockedAt)}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">อ้างอิงการโอน</p>
            <p className="font-mono text-sm text-gray-900">{w.paymentRef || '-'}</p>
            {w.paidAt && (
              <p className="text-xs text-emerald-600 mt-1">
                โอนแล้ว {formatDateTime(w.paidAt)}
              </p>
            )}
            {w.status === 'REJECTED' && w.rejectedReason && (
              <p className="text-xs text-red-600 mt-1">เหตุผล: {w.rejectedReason}</p>
            )}
          </div>
        </div>
      </div>

      {/* Reserved Commissions */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-900">
              Commissions ที่ผูกกับการถอน ({w.commissions.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              รวม ฿{formatBaht(totalCommissionSatang)}{' '}
              {totalCommissionSatang !== w.amount && (
                <span className="text-red-600 font-medium">
                  ⚠ ไม่ตรงกับยอดถอน (฿{formatBaht(w.amount)})
                </span>
              )}
            </p>
          </div>
        </div>
        {w.commissions.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">
            ยังไม่มี commission ที่ถูกจอง (กรณีถอนที่ยกเลิกไปแล้ว)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Order</th>
                  <th className="text-left px-4 py-2 font-medium">Level</th>
                  <th className="text-right px-4 py-2 font-medium">ยอด</th>
                  <th className="text-left px-4 py-2 font-medium">สถานะ</th>
                  <th className="text-left px-4 py-2 font-medium">แยกมาจาก</th>
                  <th className="text-left px-4 py-2 font-medium">สร้างเมื่อ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {w.commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-mono text-xs">
                      {c.affiliatePayment?.order?.orderNumber ||
                        c.affiliatePayment?.orderId ||
                        '-'}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                        L{c.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-medium">
                      ฿{formatBaht(c.amount)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${COMMISSION_STATUS_COLOR[c.status] || 'bg-gray-100'}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {c.parentCommissionId ? (
                        <span className="font-mono" title={c.parentCommissionId}>
                          {c.parentCommissionId.slice(-8)} (฿
                          {c.parentCommission ? formatBaht(c.parentCommission.amount) : '-'})
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {formatDateTime(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ledger Entries */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">
            Ledger Entries ({w.ledgerEntries.length})
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            ผลรวมผลกระทบต่อยอดผู้ใช้ (HOLD + RELEASE + DEBIT):{' '}
            <span className={ledgerBalance < 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
              {ledgerBalance >= 0 ? '+' : ''}฿{formatBaht(ledgerBalance)}
            </span>
          </p>
        </div>
        {w.ledgerEntries.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">ไม่มี ledger entry</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">เวลา</th>
                  <th className="text-left px-4 py-2 font-medium">ประเภท</th>
                  <th className="text-right px-4 py-2 font-medium">ยอด</th>
                  <th className="text-left px-4 py-2 font-medium">โน้ต</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {w.ledgerEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                      {formatDateTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs font-medium text-gray-700">
                        {LEDGER_TYPE_LABEL[e.type] || e.type}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-mono font-medium ${
                        e.amount > 0
                          ? 'text-emerald-700'
                          : e.amount < 0
                            ? 'text-red-700'
                            : 'text-gray-500'
                      }`}
                    >
                      {e.amount > 0 ? '+' : ''}฿{formatBaht(e.amount)}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">{e.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Timeline */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-900">
            ประวัติการเปลี่ยนสถานะ ({w.audits.length})
          </h2>
        </div>
        {w.audits.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">ไม่มีข้อมูล</p>
        ) : (
          <div className="p-6">
            <ol className="relative border-l-2 border-gray-200 space-y-6 ml-3">
              {w.audits.map((a) => {
                const actor = a.actorId ? actorById.get(a.actorId) : null
                return (
                  <li key={a.id} className="ml-4">
                    <div className="absolute -left-[9px] w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLOR[a.toStatus] || ''}`}
                      >
                        {STATUS_LABEL[a.toStatus] || a.toStatus}
                      </span>
                      {a.fromStatus && (
                        <span className="text-xs text-gray-400">
                          จาก {STATUS_LABEL[a.fromStatus] || a.fromStatus}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        · {formatDateTime(a.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      โดย{' '}
                      <span className="font-medium">
                        {actor?.name || actor?.email || a.actorRole || 'SYSTEM'}
                      </span>
                      {a.actorIp && (
                        <span className="text-xs text-gray-500 font-mono ml-2">
                          IP {a.actorIp}
                        </span>
                      )}
                    </p>
                    {a.reason && (
                      <p className="text-sm text-gray-600 mt-1 italic">"{a.reason}"</p>
                    )}
                    {a.metadata != null && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          metadata
                        </summary>
                        <pre className="text-xs bg-gray-50 rounded p-2 mt-1 overflow-x-auto text-gray-700">
                          {JSON.stringify(a.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
