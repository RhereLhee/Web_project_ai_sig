// app/admin/users/[id]/page.tsx
// Admin view of a single user's affiliate + commercial profile.
//
// Banking-grade additions:
//   - Ledger-based balance (source of truth) split into AVAILABLE / HOLDING / WITHDRAWN
//   - Commission breakdown by status with links to the originating order
//   - Direct downline (referrals) with active/PAID stats
//   - Withdrawal history links to detail page

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserAffiliateBalance, getUserLifetimeEarnings } from '@/lib/affiliate'

interface Props {
  params: Promise<{ id: string }>
}

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const COMMISSION_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700',
  HOLDING: 'bg-yellow-50 text-yellow-700',
  WITHDRAWN: 'bg-gray-100 text-gray-700',
  VOID: 'bg-red-50 text-red-700',
}

const WITHDRAWAL_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
}

async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      partner: true,
      signalSubscriptions: { orderBy: { createdAt: 'desc' }, take: 5 },
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
      withdrawals: { orderBy: { createdAt: 'desc' }, take: 10 },
      referredBy: { select: { id: true, name: true, email: true } },
      referrals: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: { where: { status: 'PAID' } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: { select: { referrals: true } },
    },
  })
}

async function getCommissionBreakdown(userId: string) {
  const rows = await prisma.commission.groupBy({
    by: ['status'],
    where: { userId },
    _sum: { amount: true },
    _count: { _all: true },
  })
  const byStatus: Record<string, { sum: number; count: number }> = {}
  for (const r of rows) {
    byStatus[r.status] = { sum: r._sum.amount ?? 0, count: r._count._all }
  }
  return byStatus
}

async function getRecentCommissions(userId: string) {
  return prisma.commission.findMany({
    where: { userId },
    include: {
      affiliatePayment: {
        select: { orderId: true, order: { select: { orderNumber: true } } },
      },
      withdrawal: { select: { id: true, withdrawalNumber: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 15,
  })
}

export default async function UserDetailPage({ params }: Props) {
  const { id } = await params
  const user = await getUser(id)
  if (!user) notFound()

  const [balance, lifetime, breakdown, recentCommissions] = await Promise.all([
    getUserAffiliateBalance(user.id),
    getUserLifetimeEarnings(user.id),
    getCommissionBreakdown(user.id),
    getRecentCommissions(user.id),
  ])

  const available = breakdown.AVAILABLE?.sum ?? 0
  const holding = breakdown.HOLDING?.sum ?? 0
  const withdrawn = breakdown.WITHDRAWN?.sum ?? 0
  const voided = breakdown.VOID?.sum ?? 0

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">รายละเอียดสมาชิก</h1>
        <Link href="/admin/users" className="text-gray-500 hover:text-gray-700">
          ← กลับ
        </Link>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold">{user.name || 'ไม่ระบุชื่อ'}</h2>
            <p className="text-gray-500">{user.email}</p>
            {user.phone && <p className="text-sm text-gray-400 font-mono">{user.phone}</p>}
            <p className="text-xs text-gray-400 mt-1 font-mono">ID: {user.id}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              user.role === 'ADMIN'
                ? 'bg-red-100 text-red-700'
                : user.role === 'PARTNER'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {user.role}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">Referral Code</p>
            <code className="text-lg font-mono font-semibold">{user.referralCode}</code>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">ทีม (Direct Referrals)</p>
            <p className="text-lg font-bold">{user._count.referrals} คน</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 uppercase">แนะนำโดย</p>
            {user.referredBy ? (
              <Link
                href={`/admin/users/${user.referredBy.id}`}
                className="text-lg hover:text-emerald-600"
              >
                {user.referredBy.name || user.referredBy.email}
              </Link>
            ) : (
              <p className="text-lg">-</p>
            )}
          </div>
        </div>
      </div>

      {/* Ledger / Affiliate summary */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">สรุปยอด Commission</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
            <p className="text-xs text-emerald-700 uppercase">ยอดคงเหลือ (ledger)</p>
            <p className="text-xl font-bold text-emerald-700 font-mono">
              ฿{formatBaht(balance)}
            </p>
            <p className="text-[11px] text-emerald-700/70 mt-1">SOURCE OF TRUTH</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase">รวมรับตลอดชีพ</p>
            <p className="text-lg font-semibold font-mono">฿{formatBaht(lifetime)}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase">
              พร้อมถอน ({breakdown.AVAILABLE?.count || 0})
            </p>
            <p className="text-lg font-semibold font-mono text-emerald-700">
              ฿{formatBaht(available)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase">
              ผูกกับถอน ({breakdown.HOLDING?.count || 0})
            </p>
            <p className="text-lg font-semibold font-mono text-yellow-700">
              ฿{formatBaht(holding)}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase">
              ถอนแล้ว ({breakdown.WITHDRAWN?.count || 0})
            </p>
            <p className="text-lg font-semibold font-mono text-gray-600">
              ฿{formatBaht(withdrawn)}
            </p>
          </div>
        </div>
        {voided > 0 && (
          <p className="text-xs text-red-600 mt-3">
            ⚠ มี commission ที่ถูกยกเลิก (VOID) มูลค่า ฿{formatBaht(voided)} —{' '}
            {breakdown.VOID?.count || 0} รายการ
          </p>
        )}
        {available + holding !== balance && (
          <p className="text-xs text-red-600 mt-3">
            ⚠ Ledger balance ไม่ตรงกับ commission AVAILABLE+HOLDING ({formatBaht(available + holding)}){' '}
            — ตรวจสอบ reconciliation
          </p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Partner Info */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Partner</h3>
          {user.partner ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">สถานะ</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    user.partner.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700'
                      : user.partner.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {user.partner.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ธนาคาร</span>
                <span>{user.partner.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">เลขบัญชี</span>
                <span className="font-mono">{user.partner.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ชื่อบัญชี</span>
                <span>{user.partner.accountName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">หมดอายุ</span>
                <span>
                  {user.partner.endDate
                    ? new Date(user.partner.endDate).toLocaleDateString('th-TH')
                    : '-'}
                </span>
              </div>
              {user.partner.withdrawPhone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">เบอร์ถอน (ล็อก)</span>
                  <span className="font-mono text-xs">{user.partner.withdrawPhone}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">ยังไม่ได้สมัคร Partner</p>
          )}
        </div>

        {/* Signal Info */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Signal Subscription</h3>
          {user.signalSubscriptions.length > 0 ? (
            <div className="space-y-3">
              {user.signalSubscriptions.map((sub) => (
                <div key={sub.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">สถานะ</span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        sub.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">ราคา</span>
                    <span className="font-mono">฿{formatBaht(sub.price)}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">หมดอายุ</span>
                    <span>
                      {sub.endDate ? new Date(sub.endDate).toLocaleDateString('th-TH') : '-'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">ยังไม่ได้สมัคร Signal</p>
          )}
        </div>
      </div>

      {/* Downline */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            ดาวน์ไลน์ชั้น 1 ({user._count.referrals})
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            แสดง 20 คนล่าสุด · เชื่อมไปหน้า user ของแต่ละคนเพื่อดูชั้นถัดไป
          </p>
        </div>
        {user.referrals.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">ยังไม่มีใครใช้ code นี้</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">สมาชิก</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-right px-4 py-2 font-medium">Orders PAID</th>
                  <th className="text-left px-4 py-2 font-medium">สมัคร</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {user.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/users/${r.id}`}
                        className="font-medium text-gray-900 hover:text-emerald-600"
                      >
                        {r.name || '-'}
                      </Link>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          r.role === 'PARTNER'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {r.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{r._count.orders}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString('th-TH')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent commissions */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            Commissions ล่าสุด ({recentCommissions.length})
          </h3>
        </div>
        {recentCommissions.length === 0 ? (
          <p className="text-sm text-gray-500 p-6 text-center">ยังไม่ได้รับ commission</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Order</th>
                  <th className="text-left px-4 py-2 font-medium">Level</th>
                  <th className="text-right px-4 py-2 font-medium">ยอด</th>
                  <th className="text-left px-4 py-2 font-medium">สถานะ</th>
                  <th className="text-left px-4 py-2 font-medium">Withdrawal</th>
                  <th className="text-left px-4 py-2 font-medium">เวลา</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentCommissions.map((c) => (
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
                    <td className="px-4 py-2">
                      {c.withdrawal ? (
                        <Link
                          href={`/admin/withdrawals/${c.withdrawal.id}`}
                          className="text-xs text-blue-600 hover:underline font-mono"
                        >
                          {c.withdrawal.withdrawalNumber.slice(-8)}
                          <span
                            className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${WITHDRAWAL_STATUS_COLOR[c.withdrawal.status] || ''}`}
                          >
                            {c.withdrawal.status}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {new Date(c.createdAt).toLocaleDateString('th-TH')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Withdrawals */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            ประวัติถอนเงิน ({user.withdrawals.length})
          </h3>
        </div>
        {user.withdrawals.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">ไม่มีประวัติถอนเงิน</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">#</th>
                  <th className="text-left px-4 py-2 font-medium">วันที่</th>
                  <th className="text-right px-4 py-2 font-medium">จำนวน</th>
                  <th className="text-left px-4 py-2 font-medium">ธนาคาร</th>
                  <th className="text-left px-4 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {user.withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/withdrawals/${w.id}`}
                        className="text-xs text-blue-600 hover:underline font-mono"
                      >
                        {w.withdrawalNumber.slice(-10)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {new Date(w.createdAt).toLocaleDateString('th-TH')}
                    </td>
                    <td className="px-4 py-2 font-medium text-emerald-700 text-right font-mono">
                      ฿{formatBaht(w.amount)}
                    </td>
                    <td className="px-4 py-2">
                      {w.bankCode}
                      <span className="text-xs text-gray-500 ml-1 font-mono">
                        {w.accountNumber}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${WITHDRAWAL_STATUS_COLOR[w.status] || 'bg-gray-100'}`}
                      >
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
