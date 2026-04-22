// app/(main)/profile/page.tsx
import { getCurrentUser } from "@/lib/jwt"
import { redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { ProfileEditButton } from "@/components/ProfileEditButton"

// ฟังก์ชันแปลงเบอร์โทรให้แสดงแบบไทย (0xxx)
function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return '-'
  
  // ถ้าขึ้นต้นด้วย 66 ให้แปลงเป็น 0
  if (phone.startsWith('66')) {
    return '0' + phone.slice(2)
  }
  // ถ้าขึ้นต้นด้วย +66 ให้แปลงเป็น 0
  if (phone.startsWith('+66')) {
    return '0' + phone.slice(3)
  }
  
  return phone
}

// ดึงข้อมูล user แบบครบถ้วน (รวม phone และ partner)
async function getFullUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      referralCode: true,
      createdAt: true,
      partner: {
        select: {
          status: true,
          endDate: true,
          withdrawPhone: true,
        }
      },
      signalSubscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { endDate: 'desc' },
        take: 1,
        select: {
          status: true,
          endDate: true,
        }
      }
    }
  })

  return user
}

async function getProfileStats(userId: string) {
  const [commissionBalance, totalReferrals] = await Promise.all([
    prisma.commission.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.user.count({
      where: { referredById: userId },
    }),
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

  // เช็คสถานะต่างๆ
  const hasSignal = user.signalSubscriptions[0]?.status === 'ACTIVE' && 
    (user.signalSubscriptions[0]?.endDate ? new Date(user.signalSubscriptions[0].endDate) > new Date() : true)
  
  const hasSub = user.partner?.status === 'ACTIVE' && 
    (user.partner?.endDate ? new Date(user.partner.endDate) > new Date() : true)

  // เช็คว่าเบอร์ถูกล็อคหรือยัง
  const isPhoneLocked = !!user.partner?.withdrawPhone

  // แปลงเบอร์โทรให้แสดงแบบไทย
  const displayPhone = formatPhoneDisplay(user.phone)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์</h1>
        <ProfileEditButton 
          user={{ 
            name: user.name, 
            phone: user.phone 
          }} 
          isPhoneLocked={isPhoneLocked}
        />
      </div>

      {/* Profile Card */}
      <div className="card">
        <div className="flex items-start space-x-6 mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{user.name || 'User'}</h2>
            <p className="text-gray-600 mb-1">{user.email}</p>
            {user.phone && (
              <p className="text-gray-500 text-sm flex items-center">
                {displayPhone}
                {isPhoneLocked && (
                  <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    ล็อค
                  </span>
                )}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              {hasSignal && (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-full">
                  Signal
                </span>
              )}
              {hasSub && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full">
                  PRO
                </span>
              )}
              {user.role === 'ADMIN' && (
                <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-semibold rounded-full">
                  Admin
                </span>
              )}
              {!hasSignal && !hasSub && (
                <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-semibold rounded-full">
                  Free
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm text-gray-600 mb-1">ยอดคงเหลือ</p>
            <p className="text-2xl font-bold text-emerald-600">฿{(stats.balance / 100).toLocaleString()}</p>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600 mb-1">ทีม</p>
            <p className="text-2xl font-bold text-blue-600">{stats.referrals} คน</p>
          </div>
          
          <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
            <p className="text-sm text-gray-600 mb-1">รหัสแนะนำ</p>
            <p className="text-lg font-mono font-bold text-cyan-600">{user.referralCode}</p>
          </div>
        </div>
      </div>

      {/* Subscriptions */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">แพ็คเกจของคุณ</h2>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Signal Access */}
          <div className={`p-4 border-2 rounded-lg ${hasSignal ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Signal Access</h3>
              {hasSignal ? (
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
            {hasSignal && user.signalSubscriptions[0]?.endDate ? (
              <p className="text-sm text-gray-600">
                หมดอายุ: {new Date(user.signalSubscriptions[0].endDate).toLocaleDateString('th-TH')}
              </p>
            ) : !hasSignal ? (
              <Link href="/signals" className="inline-block mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700">
                ซื้อ Signal 
              </Link>
            ) : null}
          </div>

          {/* Partner */}
          <div className={`p-4 border-2 rounded-lg ${hasSub ? 'border-purple-500 bg-purple-50' : 'border-gray-300 bg-gray-50'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-gray-900">Partner</h3>
              {hasSub ? (
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </div>
            {hasSub && user.partner?.endDate ? (
              <p className="text-sm text-gray-600">
                หมดอายุ: {new Date(user.partner.endDate).toLocaleDateString('th-TH')}
              </p>
            ) : !hasSub ? (
              <Link href="/partner" className="inline-block mt-2 text-sm font-medium text-purple-600 hover:text-purple-700">
                สมัคร Partner 
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/partner" className="card hover:shadow-lg transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors">Partner Dashboard</h3>
              <p className="text-sm text-gray-600 mt-1">คงเหลือ ฿{(stats.balance / 100).toLocaleString()}</p>
            </div>
            <svg className="w-6 h-6 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link href="/signals" className="card hover:shadow-lg transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">Signal Room</h3>
              <p className="text-sm text-gray-600 mt-1">ดู Signals ทั้งหมด</p>
            </div>
            <svg className="w-6 h-6 text-gray-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}