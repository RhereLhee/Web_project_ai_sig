import { prisma } from "@/lib/prisma"
import Link from "next/link"

async function getStats() {
  const [usersCount, subsCount, ordersCount, coursesCount, videosCount] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.course.count(),
    prisma.video.count(),
  ])

  const revenue = await prisma.order.aggregate({
    where: { status: 'PAID' },
    _sum: { finalAmount: true },
  })

  return {
    users: usersCount,
    activeSubs: subsCount,
    orders: ordersCount,
    courses: coursesCount,
    videos: videosCount,
    revenue: revenue._sum.finalAmount || 0,
  }
}

async function getRecentUsers() {
  return await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, email: true, createdAt: true },
  })
}

async function getRecentOrders() {
  return await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { 
      user: { select: { name: true, email: true } },
      subscription: {
        include: { plan: true }
      }
    },
  })
}

export default async function AdminDashboard() {
  const [stats, recentUsers, recentOrders] = await Promise.all([
    getStats(),
    getRecentUsers(),
    getRecentOrders(),
  ])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="stat-card">
          <p className="stat-value">{stats.users}</p>
          <p className="stat-label">สมาชิกทั้งหมด</p>
        </div>
        <div className="stat-card">
          <p className="stat-value text-emerald-600">{stats.activeSubs}</p>
          <p className="stat-label">สมาชิก PRO</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{stats.orders}</p>
          <p className="stat-label">ออเดอร์</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{stats.courses}</p>
          <p className="stat-label">คอร์ส</p>
        </div>
        <div className="stat-card">
          <p className="stat-value">{stats.videos}</p>
          <p className="stat-label">วิดีโอ</p>
        </div>
        <div className="stat-card">
          <p className="stat-value text-emerald-600">฿{stats.revenue.toLocaleString()}</p>
          <p className="stat-label">รายได้รวม</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <Link href="/admin/courses" className="card card-hover text-center">
          <span className="text-3xl mb-2 block">📚</span>
          <p className="font-medium">จัดการคอร์ส</p>
        </Link>
        <Link href="/admin/videos" className="card card-hover text-center">
          <span className="text-3xl mb-2 block">🎬</span>
          <p className="font-medium">อัพโหลดวิดีโอ</p>
        </Link>
        <Link href="/admin/users" className="card card-hover text-center">
          <span className="text-3xl mb-2 block">👥</span>
          <p className="font-medium">จัดการสมาชิก</p>
        </Link>
        <Link href="/admin/stats" className="card card-hover text-center">
          <span className="text-3xl mb-2 block">📈</span>
          <p className="font-medium">ดูสถิติ</p>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">สมาชิกใหม่</h2>
          <div className="space-y-2">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{user.name || user.email}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(user.createdAt).toLocaleDateString('th-TH')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">ออเดอร์ล่าสุด</h2>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{order.user.name || order.user.email}</p>
                  <p className="text-xs text-gray-500">
                    {order.subscription?.plan?.name || 'แพ็กเกจ'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm text-emerald-600">฿{order.finalAmount.toLocaleString()}</p>
                  <span className={`text-xs ${order.status === 'PAID' ? 'text-emerald-600' : 'text-yellow-600'}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}