import { prisma } from "@/lib/prisma"

async function getStats() {
  // Users by month
  const usersByMonth = await prisma.$queryRaw<Array<{ month: string; count: number }>>`
    SELECT to_char("createdAt", 'YYYY-MM') as month, COUNT(*)::int as count
    FROM "User"
    WHERE "createdAt" > NOW() - INTERVAL '6 months'
    GROUP BY month
    ORDER BY month
  `

  // Revenue by month
  const revenueByMonth = await prisma.$queryRaw<Array<{ month: string; total: number }>>`
    SELECT to_char("createdAt", 'YYYY-MM') as month, SUM("finalAmount")::int as total
    FROM "Order"
    WHERE status = 'PAID' AND "createdAt" > NOW() - INTERVAL '6 months'
    GROUP BY month
    ORDER BY month
  `

  // Top referrers
  const topReferrers = await prisma.user.findMany({
    where: {
      referrals: { some: {} },
    },
    include: {
      _count: { select: { referrals: true } },
    },
    orderBy: {
      referrals: { _count: 'desc' },
    },
    take: 10,
  })

  // Plan distribution
  const planDistribution = await prisma.subscription.groupBy({
    by: ['planId'],
    where: { status: 'ACTIVE' },
    _count: true,
  })

  const plans = await prisma.plan.findMany()
  const planStats = planDistribution.map(pd => ({
    plan: plans.find(p => p.id === pd.planId)?.name || 'Unknown',
    count: pd._count,
  }))

  return { usersByMonth, revenueByMonth, topReferrers, planStats }
}

export default async function AdminStatsPage() {
  const stats = await getStats()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">สถิติ</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Users by Month */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">สมาชิกใหม่รายเดือน</h2>
          <div className="space-y-2">
            {stats.usersByMonth.map((item) => (
              <div key={item.month} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.month}</span>
                <span className="font-medium">{item.count} คน</span>
              </div>
            ))}
            {stats.usersByMonth.length === 0 && (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Revenue by Month */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">รายได้รายเดือน</h2>
          <div className="space-y-2">
            {stats.revenueByMonth.map((item) => (
              <div key={item.month} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.month}</span>
                <span className="font-medium text-emerald-600">฿{(item.total || 0).toLocaleString()}</span>
              </div>
            ))}
            {stats.revenueByMonth.length === 0 && (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">แพ็กเกจที่นิยม</h2>
          <div className="space-y-2">
            {stats.planStats.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.plan}</span>
                <span className="font-medium">{item.count} คน</span>
              </div>
            ))}
            {stats.planStats.length === 0 && (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            )}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">Top Affiliate</h2>
          <div className="space-y-2">
            {stats.topReferrers.map((user, i) => (
              <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-sm">{user.name || user.email}</span>
                </div>
                <span className="font-medium">{user._count.referrals} คน</span>
              </div>
            ))}
            {stats.topReferrers.length === 0 && (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
