import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { WithdrawalActions } from "./WithdrawalActions"

interface Props {
  searchParams: Promise<{ status?: string; page?: string }>
}

async function getWithdrawals(status?: string, page: number = 1) {
  const take = 20
  const skip = (page - 1) * take

  const where: any = {}
  if (status && status !== 'ALL') {
    where.status = status
  }

  const [withdrawals, total] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.withdrawal.count({ where }),
  ])

  return { withdrawals, total, pages: Math.ceil(total / take) }
}

async function getSummary() {
  const rows = await prisma.withdrawal.groupBy({
    by: ['status'],
    _sum: { amount: true },
    _count: { _all: true },
  })
  const byStatus: Record<string, { sum: number; count: number }> = {}
  for (const r of rows) {
    byStatus[r.status] = { sum: r._sum.amount ?? 0, count: r._count._all }
  }
  return byStatus
}

export default async function AdminWithdrawalsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const [{ withdrawals, total, pages }, summary] = await Promise.all([
    getWithdrawals(params.status, page),
    getSummary(),
  ])
  const currentStatus = params.status || 'ALL'

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  const statusLabels: Record<string, string> = {
    PENDING: 'รอตรวจสอบ',
    APPROVED: 'อนุมัติแล้ว',
    PAID: 'โอนแล้ว',
    REJECTED: 'ปฏิเสธ',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">จัดการถอนเงิน ({total})</h1>
        <a
          href={`/api/admin/withdrawals/export?status=${currentStatus}`}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
        >
          ดาวน์โหลด CSV
        </a>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'รอตรวจสอบ', key: 'PENDING', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
          { label: 'อนุมัติแล้ว', key: 'APPROVED', color: 'text-blue-600 bg-blue-50 border-blue-200' },
          { label: 'โอนแล้ว', key: 'PAID', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { label: 'ปฏิเสธ', key: 'REJECTED', color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(({ label, key, color }) => (
          <div key={key} className={`p-3 rounded-lg border ${color}`}>
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="text-lg font-bold">฿{((summary[key]?.sum ?? 0) / 100).toLocaleString()}</p>
            <p className="text-xs opacity-70">{summary[key]?.count ?? 0} รายการ</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((s) => (
            <Link
              key={s}
              href={`/admin/withdrawals?status=${s}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                (params.status || 'ALL') === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'ทั้งหมด' : statusLabels[s] || s}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">สมาชิก</th>
                <th className="text-left p-3 font-medium">ติดต่อ</th>
                <th className="text-left p-3 font-medium">จำนวน</th>
                <th className="text-left p-3 font-medium">บัญชีรับเงิน</th>
                <th className="text-left p-3 font-medium">สถานะ</th>
                <th className="text-left p-3 font-medium">วันที่</th>
                <th className="text-left p-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <Link
                      href={`/admin/withdrawals/${w.id}`}
                      className="font-medium text-gray-900 hover:text-emerald-600 hover:underline"
                    >
                      {w.user.name || '-'}
                    </Link>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{w.withdrawalNumber}</p>
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      {w.user.email && (
                        <a 
                          href={`mailto:${w.user.email}`}
                          className="text-xs text-blue-600 hover:underline block"
                        >
                          {w.user.email}
                        </a>
                      )}
                      {w.phone && (
                        <a 
                          href={`tel:${w.phone}`}
                          className="text-xs text-emerald-600 hover:underline block font-mono"
                        >
                          {w.phone.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '+$1 $2-$3-$4')}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <p className="font-bold text-emerald-600 text-lg">
                      ฿{(w.amount / 100).toLocaleString()}
                    </p>
                  </td>
                  <td className="p-3">
                    <div className="space-y-0.5">
                      <p className="text-gray-900 font-medium">{w.bankCode}</p>
                      <p className="font-mono text-xs text-gray-600">{w.accountNumber}</p>
                      <p className="text-xs text-gray-500">{w.accountName}</p>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[w.status]}`}>
                      {statusLabels[w.status] || w.status}
                    </span>
                    {w.status === 'REJECTED' && w.rejectedReason && (
                      <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={w.rejectedReason}>
                        {w.rejectedReason}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-gray-500 text-xs">
                    <p>{new Date(w.createdAt).toLocaleDateString('th-TH')}</p>
                    <p>{new Date(w.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="p-3">
                    {w.status === 'PENDING' && (
                      <WithdrawalActions withdrawalId={w.id} />
                    )}
                    {w.status === 'APPROVED' && (
                      <WithdrawalActions withdrawalId={w.id} showPaid />
                    )}
                    {w.status === 'PAID' && w.paidAt && (
                      <p className="text-xs text-gray-500">
                        โอนเมื่อ {new Date(w.paidAt).toLocaleDateString('th-TH')}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {withdrawals.length === 0 && (
          <p className="text-center text-gray-500 py-8">ไม่มีรายการ</p>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/admin/withdrawals?page=${p}&status=${params.status || 'ALL'}`}
                className={`px-3 py-1 rounded ${p === page ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}