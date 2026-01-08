import Link from "next/link"
import { getUserWithSubscription } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { CopyButton } from "./CopyButton"
import { WithdrawButton } from "./WithdrawButton"

// ============================================
// Helper Functions
// ============================================

async function getPartner(userId: string) {
  return await prisma.partner.findUnique({
    where: { userId },
  })
}

async function getAffiliateStats(userId: string) {
  const [teamCount, pendingCommission, paidCommission, recentCommissions] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
    prisma.commission.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { userId, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.commission.findMany({
      where: { userId },
      include: {
        affiliatePayment: {
          include: {
            order: {
              include: { user: { select: { name: true, email: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return {
    team: teamCount,
    pendingBalance: pendingCommission._sum.amount || 0,
    totalEarned: (pendingCommission._sum.amount || 0) + (paidCommission._sum.amount || 0),
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
      partner: {
        where: { status: 'ACTIVE' },
        select: { endDate: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })
}

// ============================================
// Partner Plans
// ============================================

const PARTNER_PLANS = [
  { months: 1, price: 200, bonus: 0 },
  { months: 3, price: 600, bonus: 0, popular: true },
  { months: 6, price: 1200, bonus: 1 },
  { months: 12, price: 2400, bonus: 2 },
]

// ============================================
// Main Page
// ============================================

export default async function PartnerPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const partner = await getPartner(user.id)
  const isPartner = partner?.status === 'ACTIVE' && partner.endDate && new Date(partner.endDate) > new Date()

  // ============================================
  // Partner Dashboard (หลังซื้อ)
  // ============================================
  if (isPartner && partner) {
    const [stats, team] = await Promise.all([
      getAffiliateStats(user.id),
      getTeam(user.id),
    ])

    const daysRemaining = partner.endDate
      ? Math.ceil((new Date(partner.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Partner Dashboard</h1>

        {/* Row 1: Status + Code + Balance */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-gray-500">สถานะ</p>
                <p className="text-xl font-bold text-gray-900">Active</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{daysRemaining}</p>
                <p className="text-sm text-gray-500">วันที่เหลือ</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3">
              หมดอายุ: {new Date(partner.endDate!).toLocaleDateString('th-TH')}
            </p>
            {daysRemaining <= 7 && (
              <Link href="/partner/checkout?months=1" className="mt-3 block w-full py-2 bg-gray-900 text-white rounded-lg text-center text-sm font-medium hover:bg-gray-800 transition-colors">
                ต่ออายุ
              </Link>
            )}
          </div>

          {/* Referral Code */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-2">รหัสแนะนำ</p>
            <div className="flex items-center space-x-2">
              <code className="flex-1 bg-gray-100 rounded-lg px-4 py-3 text-gray-900 font-mono text-center">
                {user.referralCode}
              </code>
              <CopyButton code={user.referralCode} />
            </div>
          </div>

          {/* Balance */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm text-gray-500">ยอดถอนได้</p>
                <p className="text-2xl font-bold text-gray-900">฿{(stats.pendingBalance / 100).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">รวมทั้งหมด</p>
                <p className="text-lg font-semibold text-gray-700">฿{(stats.totalEarned / 100).toLocaleString()}</p>
              </div>
            </div>
            <WithdrawButton 
              balance={stats.pendingBalance} 
              bankInfo={{
                bankName: partner.bankName,
                accountNumber: partner.accountNumber,
                accountName: partner.accountName,
              }}
            />
          </div>
        </div>

        {/* Row 2: Bank + Team + Earnings */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Bank Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">บัญชีรับเงิน</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">ธนาคาร</span>
                <span className="text-gray-900">{partner.bankName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">เลขบัญชี</span>
                <span className="font-mono text-gray-900">{partner.accountNumber}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">ชื่อบัญชี</span>
                <span className="text-gray-900">{partner.accountName}</span>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-900">ทีมของคุณ</h2>
              <span className="text-gray-900 font-semibold">{stats.team} คน</span>
            </div>
            {team.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีสมาชิก</p>
            ) : (
              <div className="space-y-2">
                {team.map((member) => (
                  <div key={member.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-900 truncate">{member.name || member.email?.split('@')[0]}</span>
                    <span className="text-gray-400">{new Date(member.createdAt).toLocaleDateString('th-TH')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Earnings */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">รายได้ล่าสุด</h2>
            {stats.recentCommissions.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">ยังไม่มีรายได้</p>
            ) : (
              <div className="space-y-2">
                {stats.recentCommissions.map((comm) => (
                  <div key={comm.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0 text-sm">
                    <span className="text-gray-900 truncate">
                      {comm.affiliatePayment?.order?.user?.name || 'User'}
                    </span>
                    <span className="text-gray-900 font-medium">+฿{(comm.amount / 100).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">ข้อมูลสำคัญ</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• ต้องมีสถานะ Active ทั้ง Signal และ Partner ในรอบเดือนที่ขอถอน</p>
            <p>• ผลตอบแทนคำนวณจากการใช้งานจริงของผู้ใช้บริการที่ถูกแนะนำ</p>
            <p>• ยอดคงเหลือไม่มีวันหมดอายุ หากไม่ Active จะเก็บไว้รอรอบถัดไป</p>
            <p>• ถอนขั้นต่ำ ฿100 ดำเนินการภายใน 3 วันทำการ</p>
          </div>
          <a 
            href="/docs/partner-terms.pdf" 
            target="_blank"
            className="inline-block mt-3 text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            อ่านเงื่อนไขฉบับเต็ม →
          </a>
        </div>
      </div>
    )
  }

  // ============================================
  // ยังไม่เป็น Partner - แสดงหน้าสมัคร
  // ============================================
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">สมัคร Partner</h1>
        <p className="text-gray-500 mt-1">รับ Partner Reward จากการแนะนำบริการ</p>
      </div>

      {/* Plans */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PARTNER_PLANS.map((plan) => (
          <div 
            key={plan.months} 
            className={`bg-white rounded-xl border-2 p-5 ${plan.popular ? 'border-gray-900' : 'border-gray-200'}`}
          >
            {plan.popular && (
              <span className="inline-block px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded mb-2">
                ยอดนิยม
              </span>
            )}
            <p className="text-xl font-bold text-gray-900">{plan.months} เดือน</p>
            {plan.bonus > 0 && (
              <p className="text-sm text-gray-500">+{plan.bonus} เดือนฟรี</p>
            )}
            <p className="text-2xl font-bold text-gray-900 my-3">฿{plan.price}</p>
            <p className="text-sm text-gray-400 mb-4">฿{Math.round(plan.price / (plan.months + plan.bonus))}/เดือน</p>
            <Link
              href={`/partner/checkout?months=${plan.months}`}
              className={`block w-full py-2 rounded-lg text-center text-sm font-medium transition-colors ${
                plan.popular 
                  ? 'bg-gray-900 text-white hover:bg-gray-800' 
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              เลือก
            </Link>
          </div>
        ))}
      </div>

      {/* Terms Preview */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">เงื่อนไขการรับ Partner Reward</h2>
        <div className="text-sm text-gray-600 space-y-2">
          <p>• ต้องมี Signal Subscription และ Partner Plan ที่ Active</p>
          <p>• ผลตอบแทนคำนวณจากการใช้งานจริงของผู้ใช้บริการที่ถูกแนะนำ</p>
          <p>• ระบบไม่มีการรับประกันหรือการการันตีรายได้ใดๆ</p>
          <p>• ยอดคงเหลือไม่มีวันหมดอายุและจะไม่ถูกยึด</p>
        </div>
        <a 
          href="/docs/partner-terms.pdf" 
          target="_blank"
          className="inline-block mt-3 text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          อ่านเงื่อนไขฉบับเต็ม →
        </a>
      </div>

      {/* Key Statement */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <p className="text-sm text-gray-600">
          ระบบนี้ไม่ได้ให้ผลตอบแทนจากการชักชวนสมัครเพียงอย่างเดียว แต่ให้ผลตอบแทนจากการใช้งานบริการจริงของผู้ใช้ที่ถูกแนะนำ
        </p>
      </div>
    </div>
  )
}