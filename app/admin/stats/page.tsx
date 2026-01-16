import { prisma } from "@/lib/prisma"

async function getStats() {
  const usersByMonth = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
    SELECT to_char("createdAt", 'YYYY-MM') as month, COUNT(*) as count
    FROM "User"
    WHERE "createdAt" > NOW() - INTERVAL '6 months'
    GROUP BY month
    ORDER BY month
  `

  const revenueByMonth = await prisma.$queryRaw<Array<{ month: string; total: bigint }>>`
    SELECT to_char("createdAt", 'YYYY-MM') as month, COALESCE(SUM("finalAmount"), 0) as total
    FROM "Order"
    WHERE status = 'PAID' AND "createdAt" > NOW() - INTERVAL '6 months'
    GROUP BY month
    ORDER BY month
  `

  const topReferrers = await prisma.user.findMany({
    where: { referrals: { some: {} } },
    include: {
      _count: { select: { referrals: true } },
      commissions: { select: { amount: true, status: true } },
    },
    orderBy: { referrals: { _count: 'desc' } },
    take: 10,
  })

  const partnerStats = await prisma.partner.groupBy({ by: ['status'], _count: true })
  const signalStats = await prisma.signalSubscription.groupBy({ by: ['status'], _count: true })

  return { 
    usersByMonth: usersByMonth.map(u => ({ month: u.month, count: Number(u.count) })),
    revenueByMonth: revenueByMonth.map(r => ({ month: r.month, total: Number(r.total) })),
    topReferrers: topReferrers.map(r => ({
      ...r,
      totalEarned: r.commissions.reduce((sum, c) => sum + c.amount, 0),
      paidEarned: r.commissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + c.amount, 0),
    })),
    partnerStats,
    signalStats,
  }
}

export default async function AdminStatsPage() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">สถิติ</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">สมาชิกใหม่รายเดือน</h2>
          <div className="space-y-2">
            {stats.usersByMonth.length === 0 ? (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            ) : stats.usersByMonth.map((item) => (
              <div key={item.month} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.month}</span>
                <span className="font-medium">{item.count} คน</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">รายได้รายเดือน</h2>
          <div className="space-y-2">
            {stats.revenueByMonth.length === 0 ? (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            ) : stats.revenueByMonth.map((item) => (
              <div key={item.month} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.month}</span>
                <span className="font-medium text-emerald-600">฿{(item.total / 100).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Partner Status</h2>
          <div className="space-y-2">
            {stats.partnerStats.length === 0 ? (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            ) : stats.partnerStats.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.status}</span>
                <span className="font-medium">{item._count} คน</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Signal Subscriptions</h2>
          <div className="space-y-2">
            {stats.signalStats.length === 0 ? (
              <p className="text-gray-500 text-sm">ไม่มีข้อมูล</p>
            ) : stats.signalStats.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span className="text-sm">{item.status}</span>
                <span className="font-medium">{item._count} คน</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 md:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-4">Top Affiliates</h2>
          {stats.topReferrers.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">ไม่มีข้อมูล</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">#</th>
                  <th className="text-left p-2">สมาชิก</th>
                  <th className="text-left p-2">ทีม</th>
                  <th className="text-left p-2">รายได้รวม</th>
                  <th className="text-left p-2">จ่ายแล้ว</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.topReferrers.map((user, i) => (
                  <tr key={user.id}>
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">
                      <p className="font-medium">{user.name || user.email}</p>
                    </td>
                    <td className="p-2">{user._count.referrals} คน</td>
                    <td className="p-2 font-medium text-emerald-600">฿{(user.totalEarned / 100).toLocaleString()}</td>
                    <td className="p-2 text-gray-500">฿{(user.paidEarned / 100).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
