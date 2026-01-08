"use client"

import { useState } from "react"

interface ProfileTabsProps {
  user: {
    id: string
    name: string | null
    email: string | null
    phone: string | null
    referralCode: string
    createdAt: Date
  }
  subscription: {
    planName: string
    status: string
    endDate: Date | null
  } | null
  affiliateStats: {
    totalTeam: number
    directReferrals: number
    totalEarnings: number
    pendingEarnings: number
  }
  team: Array<{ id: string; name: string | null; email: string | null; createdAt: Date }>
  commissions: Array<{ id: string; amount: number; level: number; status: string; createdAt: Date }>
  orders: Array<{ id: string; orderNumber: string; finalAmount: number; status: string; createdAt: Date; subscription: { plan: { name: string } | null } }>
}

export function ProfileTabs({ user, subscription, affiliateStats, team, commissions, orders }: ProfileTabsProps) {
  const [tab, setTab] = useState("info")
  const [copied, setCopied] = useState(false)

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${user.referralCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const daysRemaining = subscription?.endDate
    ? Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div>
      {/* Tab Buttons */}
      <div className="flex space-x-1 mb-6 border-b">
        {[
          { id: "info", label: "ข้อมูล" },
          { id: "affiliate", label: "Affiliate" },
          { id: "wallet", label: "การเงิน" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Info */}
      {tab === "info" && (
        <div className="space-y-6">
          {/* User Info */}
          <div className="card">
            <h2 className="font-semibold mb-4">ข้อมูลส่วนตัว</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">ชื่อ</label>
                <p className="font-medium">{user.name || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">อีเมล</label>
                <p className="font-medium">{user.email || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">เบอร์โทร</label>
                <p className="font-medium">{user.phone || "-"}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">สมาชิกตั้งแต่</label>
                <p className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString("th-TH")}
                </p>
              </div>
            </div>
          </div>

          {/* Subscription */}
          <div className="card">
            <h2 className="font-semibold mb-4">แพ็กเกจ</h2>
            {subscription ? (
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{subscription.planName}</p>
                  <p className="text-sm text-gray-500">
                    หมดอายุ: {subscription.endDate
                      ? new Date(subscription.endDate).toLocaleDateString("th-TH")
                      : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`badge ${subscription.status === "ACTIVE" ? "badge-success" : "badge-warning"}`}>
                    {subscription.status === "ACTIVE" ? "ใช้งานอยู่" : subscription.status}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">เหลือ {daysRemaining} วัน</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-4">ยังไม่มีแพ็กเกจ</p>
                <a href="/subscription" className="btn btn-primary">
                  สมัครแพ็กเกจ
                </a>
              </div>
            )}
          </div>

          {/* Referral Code */}
          <div className="card bg-emerald-50 border-emerald-200">
            <h2 className="font-semibold mb-2">รหัสแนะนำของคุณ</h2>
            <p className="text-sm text-gray-600 mb-4">แชร์รหัสนี้ให้เพื่อนเพื่อรับค่าคอมมิชชั่น</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-4 py-2 bg-white rounded border text-lg font-mono text-emerald-600">
                {user.referralCode}
              </code>
              <button onClick={copyReferralLink} className="btn btn-primary">
                {copied ? "คัดลอกแล้ว!" : "คัดลอกลิงก์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Affiliate */}
      {tab === "affiliate" && (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-2xl font-bold">{affiliateStats.totalTeam}</p>
              <p className="text-sm text-gray-500">ทีมทั้งหมด</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold">{affiliateStats.directReferrals}</p>
              <p className="text-sm text-gray-500">แนะนำโดยตรง</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-emerald-600">
                ฿{affiliateStats.totalEarnings.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">รายได้รวม</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-yellow-600">
                ฿{affiliateStats.pendingEarnings.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">รอดำเนินการ</p>
            </div>
          </div>

          {/* Team */}
          <div className="card">
            <h2 className="font-semibold mb-4">ทีมของคุณ</h2>
            {team.length === 0 ? (
              <p className="text-gray-500 text-center py-4">ยังไม่มีทีม</p>
            ) : (
              <div className="space-y-3">
                {team.map((member) => (
                  <div key={member.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{member.name || member.email}</p>
                      <p className="text-sm text-gray-500">
                        สมัคร {new Date(member.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Commission History */}
          <div className="card">
            <h2 className="font-semibold mb-4">ประวัติค่าคอมมิชชั่น</h2>
            {commissions.length === 0 ? (
              <p className="text-gray-500 text-center py-4">ยังไม่มีค่าคอมมิชชั่น</p>
            ) : (
              <div className="space-y-3">
                {commissions.map((c) => (
                  <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm">Level {c.level}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(c.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-emerald-600">+฿{(c.amount / 100).toFixed(2)}</p>
                      <span className={`text-xs ${c.status === "PAID" ? "text-emerald-600" : "text-yellow-600"}`}>
                        {c.status === "PAID" ? "จ่ายแล้ว" : "รอจ่าย"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Wallet */}
      {tab === "wallet" && (
        <div className="space-y-6">
          {/* Balance */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card bg-emerald-50 border-emerald-200">
              <p className="text-sm text-emerald-700">ยอดคงเหลือ</p>
              <p className="text-3xl font-bold text-emerald-800">
                ฿{affiliateStats.totalEarnings.toLocaleString()}
              </p>
              <button className="btn btn-primary w-full mt-4">ถอนเงิน</button>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">รอดำเนินการ</p>
              <p className="text-3xl font-bold text-yellow-600">
                ฿{affiliateStats.pendingEarnings.toLocaleString()}
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">รายได้ทั้งหมด</p>
              <p className="text-3xl font-bold">
                ฿{affiliateStats.totalEarnings.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Payment History */}
          <div className="card">
            <h2 className="font-semibold mb-4">ประวัติการชำระเงิน</h2>
            {orders.length === 0 ? (
              <p className="text-gray-500 text-center py-4">ยังไม่มีประวัติ</p>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{order.subscription?.plan?.name || "แพ็กเกจ"}</p>
                      <p className="text-xs text-gray-500">
                        {order.orderNumber} • {new Date(order.createdAt).toLocaleDateString("th-TH")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">฿{order.finalAmount.toLocaleString()}</p>
                      <span className={`text-xs ${order.status === "PAID" ? "text-emerald-600" : "text-yellow-600"}`}>
                        {order.status === "PAID" ? "ชำระแล้ว" : order.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
