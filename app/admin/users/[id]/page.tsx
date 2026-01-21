import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"

interface Props {
  params: Promise<{ id: string }>
}

async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      partner: true,
      signalSubscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      commissions: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      withdrawals: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
      referredBy: {
        select: { name: true, email: true },
      },
      _count: {
        select: { referrals: true },
      },
    },
  })

  return user
}

export default async function UserDetailPage({ params }: Props) {
  // Next.js 15: params is a Promise, must await
  const { id } = await params
  const user = await getUser(id)

  if (!user) {
    notFound()
  }

  const totalCommissions = user.commissions.reduce((sum, c) => sum + c.amount, 0)
  const paidCommissions = user.commissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + c.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">รายละเอียดสมาชิก</h1>
        <Link href="/admin/users" className="text-gray-500 hover:text-gray-700">
          ← กลับ
        </Link>
      </div>

      {/* User Info */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{user.name || 'ไม่ระบุชื่อ'}</h2>
            <p className="text-gray-500">{user.email}</p>
            {user.phone && <p className="text-sm text-gray-400">📱 {user.phone}</p>}
            <p className="text-sm text-gray-400 mt-1">ID: {user.id}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
            user.role === 'PARTNER' ? 'bg-purple-100 text-purple-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {user.role}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Referral Code</p>
            <code className="text-lg font-mono">{user.referralCode}</code>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">ทีม (Referrals)</p>
            <p className="text-lg font-bold">{user._count.referrals} คน</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">แนะนำโดย</p>
            <p className="text-lg">{user.referredBy?.name || user.referredBy?.email || '-'}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Partner Info */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">🤝 Partner</h3>
          {user.partner ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">สถานะ</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  user.partner.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                  user.partner.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
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
                <span>{user.partner.endDate ? new Date(user.partner.endDate).toLocaleDateString('th-TH') : '-'}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">ยังไม่ได้สมัคร Partner</p>
          )}
        </div>

        {/* Signal Info */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">📡 Signal Subscription</h3>
          {user.signalSubscriptions.length > 0 ? (
            <div className="space-y-3">
              {user.signalSubscriptions.map((sub) => (
                <div key={sub.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-gray-500">สถานะ</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      sub.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {sub.status}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">ราคา</span>
                    <span>฿{(sub.price / 100).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-500">หมดอายุ</span>
                    <span>{sub.endDate ? new Date(sub.endDate).toLocaleDateString('th-TH') : '-'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">ยังไม่ได้สมัคร Signal</p>
          )}
        </div>

        {/* Commissions */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">💰 คอมมิชชั่น</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">รวมทั้งหมด</p>
              <p className="font-bold text-emerald-600">฿{(totalCommissions / 100).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">จ่ายแล้ว</p>
              <p className="font-bold">฿{(paidCommissions / 100).toLocaleString()}</p>
            </div>
          </div>
          {user.commissions.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {user.commissions.slice(0, 5).map((c) => (
                <div key={c.id} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                  <span>Level {c.level}</span>
                  <span className="font-medium">฿{(c.amount / 100).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center">ไม่มีคอมมิชชั่น</p>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">💳 ออเดอร์ล่าสุด</h3>
          {user.orders.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {user.orders.slice(0, 5).map((order) => (
                <div key={order.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                  <div>
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      order.orderType === 'PARTNER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {order.orderType}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">฿{(order.finalAmount / 100).toLocaleString()}</p>
                    <span className={`text-xs ${order.status === 'PAID' ? 'text-emerald-600' : 'text-yellow-600'}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center">ไม่มีออเดอร์</p>
          )}
        </div>

        {/* Withdrawals */}
        <div className="bg-white rounded-lg border p-6 lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">💸 ประวัติถอนเงิน</h3>
          {user.withdrawals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">วันที่</th>
                    <th className="text-left p-2">จำนวน</th>
                    <th className="text-left p-2">ธนาคาร</th>
                    <th className="text-left p-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {user.withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="p-2">{new Date(w.createdAt).toLocaleDateString('th-TH')}</td>
                      <td className="p-2 font-medium text-emerald-600">฿{(w.amount / 100).toLocaleString()}</td>
                      <td className="p-2">{w.bankCode}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          w.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                          w.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                          w.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm text-center py-4">ไม่มีประวัติถอนเงิน</p>
          )}
        </div>
      </div>
    </div>
  )
}