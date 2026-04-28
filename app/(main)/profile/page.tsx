// app/(main)/profile/page.tsx
import { getCurrentUser } from "@/lib/jwt"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { ProfileActions } from "./ProfileActions"
import { AvatarUpload } from "@/components/AvatarUpload"

function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return "-"
  if (phone.startsWith("66")) return "0" + phone.slice(2)
  if (phone.startsWith("+66")) return "0" + phone.slice(3)
  return phone
}

async function getFullUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      referralCode: true,
      referredById: true,
      createdAt: true,
      partner: {
        select: { status: true, endDate: true, withdrawPhone: true },
      },
      signalSubscriptions: {
        where: { status: "ACTIVE" },
        orderBy: { endDate: "desc" },
        take: 1,
        select: { status: true, endDate: true },
      },
    },
  })
}

async function getProfileStats(userId: string) {
  const [commissionBalance, totalReferrals] = await Promise.all([
    prisma.commission.aggregate({
      where: { userId, status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.user.count({ where: { referredById: userId } }),
  ])
  return {
    balance: commissionBalance._sum.amount || 0,
    referrals: totalReferrals,
  }
}

export default async function ProfilePage() {
  const payload = await getCurrentUser()
  if (!payload) redirect("/login")

  const user = await getFullUserProfile(payload.userId)
  if (!user) redirect("/login")

  const stats = await getProfileStats(user.id)

  const hasSignal =
    user.signalSubscriptions[0]?.status === "ACTIVE" &&
    (user.signalSubscriptions[0]?.endDate
      ? new Date(user.signalSubscriptions[0].endDate) > new Date()
      : true)

  const hasSub =
    user.partner?.status === "ACTIVE" &&
    (user.partner?.endDate ? new Date(user.partner.endDate) > new Date() : true)

  const isPhoneLocked = !!user.partner?.withdrawPhone
  const displayPhone = formatPhoneDisplay(user.phone)

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* ── Avatar + name header ── */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-5">
          <AvatarUpload currentImage={user.image} userName={user.name} userEmail={user.email} />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">{user.name || "User"}</h1>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            {user.phone && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                {displayPhone}
                {isPhoneLocked && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">ล็อค</span>
                )}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {hasSignal && (
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">Signal</span>
              )}
              {hasSub && (
                <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">PRO</span>
              )}
              {user.role === "ADMIN" && (
                <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded-full">Admin</span>
              )}
              {!hasSignal && !hasSub && (
                <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">Free</span>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 mt-5 pt-5 border-t border-gray-100 overflow-hidden">
          <div className="px-2 text-center">
            <p className="text-xs text-gray-500 mb-0.5">ยอดคงเหลือ</p>
            <p className="text-base font-bold text-emerald-600">฿{(stats.balance / 100).toLocaleString()}</p>
          </div>
          <div className="px-2 text-center">
            <p className="text-xs text-gray-500 mb-0.5">ทีม</p>
            <p className="text-base font-bold text-blue-600">{stats.referrals} คน</p>
          </div>
          <div className="px-2 text-center min-w-0">
            <p className="text-xs text-gray-500 mb-0.5">รหัสแนะนำ</p>
            <p className="text-xs font-mono font-bold text-cyan-600 break-all leading-tight">{user.referralCode}</p>
          </div>
        </div>
      </div>

      {/* ── แพ็คเกจ ── */}
      <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">แพ็คเกจของคุณ</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Signal */}
          <div className={`p-4 border-2 rounded-xl ${hasSignal ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 text-sm">Signal Access</span>
              {hasSignal ? (
                <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="w-5 h-5 bg-gray-300 rounded-full" />
              )}
            </div>
            {hasSignal && user.signalSubscriptions[0]?.endDate ? (
              <p className="text-xs text-gray-500">หมดอายุ {new Date(user.signalSubscriptions[0].endDate).toLocaleDateString("th-TH")}</p>
            ) : (
              <Link href="/signals" className="text-xs font-medium text-emerald-600 hover:underline">ซื้อ Signal →</Link>
            )}
          </div>

          {/* Partner */}
          <div className={`p-4 border-2 rounded-xl ${hasSub ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50"}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 text-sm">Partner</span>
              {hasSub ? (
                <span className="w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              ) : (
                <span className="w-5 h-5 bg-gray-300 rounded-full" />
              )}
            </div>
            {hasSub && user.partner?.endDate ? (
              <p className="text-xs text-gray-500">หมดอายุ {new Date(user.partner.endDate).toLocaleDateString("th-TH")}</p>
            ) : (
              <Link href="/partner" className="text-xs font-medium text-purple-600 hover:underline">สมัคร Partner →</Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/partner" className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow group">
          <div>
            <p className="font-medium text-sm text-gray-900 group-hover:text-emerald-600 transition-colors">Partner Dashboard</p>
            <p className="text-xs text-gray-500 mt-0.5">คงเหลือ ฿{(stats.balance / 100).toLocaleString()}</p>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link href="/signals" className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow group">
          <div>
            <p className="font-medium text-sm text-gray-900 group-hover:text-purple-600 transition-colors">Signal Room</p>
            <p className="text-xs text-gray-500 mt-0.5">ดู Signals ทั้งหมด</p>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ── Settings sections (client) ── */}
      <ProfileActions
        user={{ name: user.name, phone: displayPhone, email: user.email ?? "" }}
        isPhoneLocked={isPhoneLocked}
        hasReferrals={stats.referrals > 0}
      />
    </div>
  )
}
