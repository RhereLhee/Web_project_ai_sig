import { prisma } from "@/lib/prisma"
import Link from "next/link"

async function getTopAffiliates(limit: number = 50) {
  const rows = await prisma.commission.groupBy({
    by: ['userId'],
    where: { status: { in: ['AVAILABLE', 'WITHDRAWN'] } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  })

  if (rows.length === 0) return []

  const userIds = rows.map((r) => r.userId)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      phone: true,
      image: true,
      _count: { select: { referrals: true } },
    },
  })

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    totalSatang: r._sum.amount ?? 0,
    user: userMap[r.userId] ?? null,
  }))
}

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPhone(phone: string | null | undefined) {
  if (!phone) return '-'
  if (phone.startsWith('66')) return '0' + phone.slice(2)
  if (phone.startsWith('+66')) return '0' + phone.slice(3)
  return phone
}

const RANK_COLORS = [
  'bg-yellow-400 text-yellow-900',
  'bg-gray-300 text-gray-800',
  'bg-amber-600 text-amber-100',
]

export default async function TopAffiliatesPage() {
  const affiliates = await getTopAffiliates(50)

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Top Affiliate</h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← กลับหน้าหลัก
        </Link>
      </div>

      {affiliates.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          ยังไม่มีข้อมูล commission
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {affiliates.map((a) => {
            const name = a.user?.name || 'ไม่ระบุชื่อ'
            const initial = name.charAt(0)
            const rankColorClass =
              a.rank <= 3 ? RANK_COLORS[a.rank - 1] : 'bg-gray-100 text-gray-600'
            const teamCount = a.user?._count.referrals ?? 0
            const phone = formatPhone(a.user?.phone)

            return (
              <div
                key={a.userId}
                className="flex items-center space-x-4 px-5 py-4 border-b last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                {/* Rank */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${rankColorClass}`}
                >
                  {a.rank}
                </div>

                {/* Avatar */}
                <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-lg font-bold">
                  {a.user?.image ? (
                    <img
                      src={a.user.image}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{name}</p>
                  <p className="text-sm text-gray-500">
                    ทีม {teamCount} คน
                    {a.user?.phone && (
                      <span className="ml-3 font-mono text-xs">{phone}</span>
                    )}
                  </p>
                </div>

                {/* Earnings */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-emerald-600">฿{formatBaht(a.totalSatang)}</p>
                  <p className="text-xs text-gray-400">commission รวม</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
