import { prisma } from "@/lib/prisma"
import Link from "next/link"

async function getTopAffiliates(limit: number = 5) {
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
    where: {
      id: { in: userIds },
      NOT: { email: { endsWith: '@deleted.invalid' } },
    },
    select: {
      id: true,
      name: true,
      image: true,
      _count: { select: { referrals: true } },
    },
  })

  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  return rows
    .map((r) => ({
      userId: r.userId,
      totalSatang: r._sum.amount ?? 0,
      user: userMap[r.userId] ?? null,
    }))
    .filter((a) => a.user !== null)
    .map((a, i) => ({ ...a, rank: i + 1 }))
}

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString('th-TH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

const RANK_COLORS = [
  'bg-yellow-400 text-yellow-900',
  'bg-gray-300 text-gray-800',
  'bg-amber-600 text-amber-100',
  'bg-gray-100 text-gray-600',
  'bg-gray-100 text-gray-600',
]

interface TopAffiliatesProps {
  currentUserId?: string
}

export async function TopAffiliates({ currentUserId }: TopAffiliatesProps) {
  const affiliates = await getTopAffiliates(5)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900">Top Affiliate</h2>
        <Link
          href="/affiliates/top"
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          ดูทั้งหมด →
        </Link>
      </div>

      {affiliates.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="space-y-3">
          {affiliates.map((a) => {
            const isMe = a.userId === currentUserId
            const name = isMe ? 'คุณ' : (a.user?.name || 'ไม่ระบุชื่อ')
            const initial = (a.user?.name || 'U').charAt(0)
            const colorClass = RANK_COLORS[Math.min(a.rank - 1, RANK_COLORS.length - 1)]
            const teamCount = a.user?._count.referrals ?? 0

            return (
              <div key={a.userId} className={`flex items-center space-x-3 ${isMe ? 'bg-emerald-50 -mx-2 px-2 py-1 rounded-lg' : ''}`}>
                {/* Rank */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
                  {a.rank}
                </div>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-sm font-bold">
                  {a.user?.image ? (
                    <img src={a.user.image} alt={name} className="w-full h-full object-cover" />
                  ) : (
                    initial
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {name}
                    {isMe && <span className="ml-1 text-xs text-emerald-600 font-normal">(คุณ)</span>}
                  </p>
                  <p className="text-xs text-gray-500">ทีม {teamCount} คน</p>
                </div>

                {/* Earnings */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-emerald-600">฿{formatBaht(a.totalSatang)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
