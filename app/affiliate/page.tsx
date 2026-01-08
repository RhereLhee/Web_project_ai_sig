import { getUserWithSubscription, hasActiveSubscription } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { CopyButton } from "./CopyButton"

async function getAffiliateStats(userId: string) {
  const [teamCount, totalCommission, recentCommissions] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.commission.aggregate({
      where: { userId: userId, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.commission.findMany({
      where: { userId: userId },
      include: {
        user: { select: { name: true, email: true } },
        affiliatePayment: {
          include: {
            order: {
              include: {
                subscription: {
                  include: { plan: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return {
    team: teamCount,
    totalEarned: totalCommission._sum.amount || 0,
    recentCommissions,
  }
}

async function getTeam(userId: string) {
  return await prisma.user.findMany({
    where: { referredById: userId },
    select: { 
      id: true, 
      name: true, 
      email: true, 
      createdAt: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        take: 1,
        select: { plan: { select: { name: true } } }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
}

export default async function AffiliatePage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  // ต้องมี Subscription ถึงจะเข้าหน้านี้ได้
  const hasSub = hasActiveSubscription(user)
  if (!hasSub) {
    redirect("/pricing")
  }

  const [stats, team] = await Promise.all([
    getAffiliateStats(user.id),
    getTeam(user.id),
  ])

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">🤝 Affiliate</h1>

      {/* Balance Card */}
      <div className="card bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-gray-400 text-sm">ยอดคงเหลือ</p>
            <p className="text-3xl font-bold mt-1">฿{(stats.totalEarned / 100).toLocaleString()}</p>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">รายได้รวม</p>
            <p className="text-2xl font-bold mt-1 text-emerald-400">฿{(stats.totalEarned / 100).toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-400 mb-2">รหัสแนะนำของคุณ</p>
          <div className="flex items-center space-x-2">
            <code className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-emerald-400 font-mono text-center">
              {user.referralCode}
            </code>
            <CopyButton code={user.referralCode} />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Stats */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">📊 สถิติ</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-600">สมาชิกในทีม</span>
              <span className="text-lg font-bold">{stats.team}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <span className="text-sm text-gray-600">รายได้รวม</span>
              <span className="text-lg font-bold text-emerald-600">฿{(stats.totalEarned / 100).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Commission Formula */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">🔢 สูตรค่าคอม</h2>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm">
            <p>Pool = ฿300 / ออเดอร์</p>
            <p>r = 0.8 (ลดหลั่น)</p>
            <p className="mt-2 text-emerald-600">payment(n) = Pool × r^(n-1) / Σ</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ยิ่งใกล้ผู้ซื้อ ยิ่งได้มาก · ไม่จำกัดชั้น
          </p>
        </div>
      </div>

      {/* Team */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">👥 ทีมของคุณ ({stats.team} คน)</h2>
        
        {team.length === 0 ? (
          <p className="text-gray-500 text-center py-6">ยังไม่มีสมาชิกในทีม</p>
        ) : (
          <div className="space-y-2">
            {team.map((member) => (
              <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{member.name || member.email}</p>
                  <p className="text-xs text-gray-500">{member.email}</p>
                </div>
                <div className="flex items-center space-x-2">
                  {member.subscriptions[0] && (
                    <span className="badge badge-success text-xs">
                      {member.subscriptions[0].plan?.name}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(member.createdAt).toLocaleDateString('th-TH')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Commissions */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">💰 รายได้ล่าสุด</h2>
        
        {stats.recentCommissions.length === 0 ? (
          <p className="text-gray-500 text-center py-6">ยังไม่มีรายได้</p>
        ) : (
          <div className="space-y-2">
            {stats.recentCommissions.map((comm) => (
              <div key={comm.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">
                    {comm.user.name || comm.user.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    ชั้นที่ {comm.level} · น้ำหนัก {comm.weight.toFixed(2)}
                  </p>
                </div>
                <span className="text-emerald-600 font-medium">
                  +฿{(comm.amount / 100).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}