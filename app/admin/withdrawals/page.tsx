import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { WithdrawalActions } from "./WithdrawalActions"

interface Props {
  searchParams: { status?: string; page?: string }
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
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.withdrawal.count({ where }),
  ])

  return { withdrawals, total, pages: Math.ceil(total / take) }
}

export default async function AdminWithdrawalsPage({ searchParams }: Props) {
  const page = parseInt(searchParams.page || '1')
  const { withdrawals, total, pages } = await getWithdrawals(searchParams.status, page)

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-blue-100 text-blue-700',
    PAID: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">จัดการถอนเงิน ({total})</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex gap-2">
          {['ALL', 'PENDING', 'APPROVED', 'PAID', 'REJECTED'].map((s) => (
            <Link
              key={s}
              href={`/admin/withdrawals?status=${s}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                (searchParams.status || 'ALL') === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'ALL' ? 'ทั้งหมด' : s}
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
                <th className="text-left p-3 font-medium">จำนวน</th>
                <th className="text-left p-3 font-medium">ธนาคาร</th>
                <th className="text-left p-3 font-medium">เลขบัญชี</th>
                <th className="text-left p-3 font-medium">ชื่อบัญชี</th>
                <th className="text-left p-3 font-medium">สถานะ</th>
                <th className="text-left p-3 font-medium">วันที่</th>
                <th className="text-left p-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <p className="font-medium">{w.user.name || '-'}</p>
                    <p className="text-xs text-gray-500">{w.user.email}</p>
                  </td>
                  <td className="p-3 font-bold text-emerald-600">
                    ฿{(w.amount / 100).toLocaleString()}
                  </td>
                  <td className="p-3">{w.bankName}</td>
                  <td className="p-3 font-mono text-xs">{w.accountNumber}</td>
                  <td className="p-3">{w.accountName}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[w.status]}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">
                    {new Date(w.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="p-3">
                    {w.status === 'PENDING' && (
                      <WithdrawalActions withdrawalId={w.id} />
                    )}
                    {w.status === 'APPROVED' && (
                      <WithdrawalActions withdrawalId={w.id} showPaid />
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
                href={`/admin/withdrawals?page=${p}&status=${searchParams.status || 'ALL'}`}
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
