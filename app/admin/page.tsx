import { prisma } from "@/lib/prisma"
import Link from "next/link"

async function getStats() {
  // ลด parallel queries เพื่อไม่ให้ connection pool เต็ม
  const usersCount = await prisma.user.count()
  const partnersCount = await prisma.partner.count({ where: { status: 'ACTIVE' } })
  const signalSubsCount = await prisma.signalSubscription.count({ where: { status: 'ACTIVE' } })
  const paidOrdersCount = await prisma.order.count({ where: { status: 'PAID' } })
  const coursesCount = await prisma.course.count()
  const videosCount = await prisma.video.count()
  const pendingWithdrawals = await prisma.withdrawal.count({ where: { status: 'PENDING' } })
  const pendingOrders = await prisma.order.count({ where: { status: 'PENDING' } })

  const revenue = await prisma.order.aggregate({
    where: { status: 'PAID' },
    _sum: { finalAmount: true },
  })

  const pendingCommissions = await prisma.commission.aggregate({
    where: { status: 'PENDING' },
    _sum: { amount: true },
  })

  return {
    users: usersCount,
    partners: partnersCount,
    signalSubs: signalSubsCount,
    orders: paidOrdersCount,
    courses: coursesCount,
    videos: videosCount,
    revenue: revenue._sum.finalAmount || 0,
    pendingWithdrawals,
    pendingOrders,
    pendingCommissions: pendingCommissions._sum.amount || 0,
  }
}

async function getRecentUsers() {
  return await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, name: true, email: true, createdAt: true, role: true },
  })
}

async function getRecentOrders() {
  return await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { 
      user: { select: { name: true, email: true } },
    },
  })
}

async function getPendingWithdrawals() {
  return await prisma.withdrawal.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { user: { select: { name: true, email: true } } },
  })
}

export default async function AdminDashboard() {
  // เรียงลำดับ query เพื่อไม่ให้ connection pool เต็ม
  const stats = await getStats()
  const recentUsers = await getRecentUsers()
  const recentOrders = await getRecentOrders()
  const pendingWithdrawals = await getPendingWithdrawals()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      {/* Alerts */}
      {(stats.pendingWithdrawals > 0 || stats.pendingOrders > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-800 mb-2">⚠️ ต้องดำเนินการ</h2>
          <div className="flex flex-wrap gap-4 text-sm">
            {stats.pendingWithdrawals > 0 && (
              <Link href="/admin/withdrawals" className="text-yellow-700 hover:underline">
                • รอถอนเงิน {stats.pendingWithdrawals} รายการ
              </Link>
            )}
            {stats.pendingOrders > 0 && (
              <Link href="/admin/orders?status=PENDING" className="text-yellow-700 hover:underline">
                • รอตรวจสอบ {stats.pendingOrders} ออเดอร์
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-2xl font-bold text-gray-900">{stats.users}</p>
          <p className="text-sm text-gray-500">สมาชิกทั้งหมด</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-2xl font-bold text-purple-600">{stats.partners}</p>
          <p className="text-sm text-gray-500">Partner Active</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-2xl font-bold text-blue-600">{stats.signalSubs}</p>
          <p className="text-sm text-gray-500">Signal Active</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-2xl font-bold text-gray-900">{stats.orders}</p>
          <p className="text-sm text-gray-500">ออเดอร์ PAID</p>
        </div>
        <div className="bg-white rounded-lg p-4 border">
          <p className="text-2xl font-bold text-emerald-600">฿{(stats.revenue / 100).toLocaleString()}</p>
          <p className="text-sm text-gray-500">รายได้รวม</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-6 gap-3">
        <Link href="/admin/users" className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow text-center">
          <span className="text-2xl">👥</span>
          <p className="text-sm font-medium mt-1">สมาชิก</p>
        </Link>
        <Link href="/admin/partners" className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow text-center">
          <span className="text-2xl">🤝</span>
          <p className="text-sm font-medium mt-1">Partners</p>
        </Link>
        <Link href="/admin/orders" className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow text-center">
          <span className="text-2xl">💳</span>
          <p className="text-sm font-medium mt-1">ออเดอร์</p>
        </Link>
        <Link href="/admin/withdrawals" className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow text-center relative">
          <span className="text-2xl">💸</span>
          <p className="text-sm font-medium mt-1">ถอนเงิน</p>
          {stats.pendingWithdrawals > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {stats.pendingWithdrawals}
            </span>
          )}
        </Link>
        <Link href="/admin/courses" className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow text-center">
          <span className="text-2xl">📚</span>
          <p className="text-sm font-medium mt-1">คอร์ส</p>
        </Link>
        <Link href="/admin/settings" className="bg-white p-4 rounded-lg border hover:shadow-md transition-shadow text-center">
          <span className="text-2xl">⚙️</span>
          <p className="text-sm font-medium mt-1">ตั้งค่า</p>
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Pending Withdrawals */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">รอถอนเงิน</h2>
            <Link href="/admin/withdrawals" className="text-sm text-emerald-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="space-y-2">
            {pendingWithdrawals.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">ไม่มีรายการรอ</p>
            ) : (
              pendingWithdrawals.map((w) => (
                <div key={w.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-sm">{w.user.name || w.user.email}</p>
                    <p className="text-xs text-gray-500">{w.bankName}</p>
                  </div>
                  <p className="font-medium text-emerald-600">฿{(w.amount / 100).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">สมาชิกใหม่</h2>
            <Link href="/admin/users" className="text-sm text-emerald-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="space-y-2">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{user.name || 'ไม่ระบุ'}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  user.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 
                  user.role === 'PARTNER' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {user.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-gray-900">ออเดอร์ล่าสุด</h2>
            <Link href="/admin/orders" className="text-sm text-emerald-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-sm">{order.user.name || order.user.email}</p>
                  <p className="text-xs text-gray-500">{order.orderType}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">฿{(order.finalAmount / 100).toLocaleString()}</p>
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
