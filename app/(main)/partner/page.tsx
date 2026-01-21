// app/(main)/partner/page.tsx
import Link from "next/link"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { CopyButton } from "./CopyButton"
import { WithdrawButton } from "./WithdrawButton"

// ============================================
// Helper Functions
// ============================================

async function getPartnerWithUser(userId: string) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      referralCode: true,
      partner: true,
    }
  })
}

async function getAffiliateStats(userId: string) {
  const [teamCount, recentCommissions] = await Promise.all([
    prisma.user.count({ where: { referredById: userId } }),
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

  // คำนวณยอดจาก withdrawnAmount pattern
  const allCommissions = await prisma.commission.findMany({
    where: { userId },
  })

  // ยอดถอนได้ = SUM(amount - withdrawnAmount) where status = AVAILABLE
  const pendingBalance = allCommissions
    .filter(c => c.status === 'AVAILABLE')
    .reduce((sum, c) => sum + (c.amount - c.withdrawnAmount), 0)

  // ยอดที่ถอนไปแล้ว = SUM(withdrawnAmount)
  const withdrawnBalance = allCommissions.reduce((sum, c) => sum + c.withdrawnAmount, 0)

  // ยอดรวมทั้งหมด = SUM(amount)
  const totalEarned = allCommissions.reduce((sum, c) => sum + c.amount, 0)

  return {
    team: teamCount,
    pendingBalance,      // ถอนได้
    totalEarned,         // รวมทั้งหมด
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

async function getWithdrawalHistory(userId: string) {
  return await prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })
}

// ============================================
// Partner Plans - ราคาใหม่ ฿199
// ============================================

const PARTNER_PLANS = [
  { months: 1, price: 199, bonus: 0 },
  { months: 3, price: 499, bonus: 1 },
  { months: 6, price: 899, bonus: 2 },
  { months: 12, price: 1499, bonus: 3 },
]

// ============================================
// Withdrawal Status Component
// ============================================

function WithdrawalStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'รอตรวจสอบ' },
    APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'กำลังดำเนินการ' },
    PAID: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'โอนแล้ว' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'ปฏิเสธ' },
  }

  const { bg, text, label } = config[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status }

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  )
}

// ============================================
// Main Page
// ============================================

export default async function PartnerPage() {
  const payload = await getCurrentUser()
  if (!payload) redirect("/login")

  const userData = await getPartnerWithUser(payload.userId)
  if (!userData) redirect("/login")

  const partner = userData.partner
  const isPartner = partner?.status === 'ACTIVE' && partner.endDate && new Date(partner.endDate) > new Date()

  // ============================================
  // Partner Dashboard (หลังซื้อ)
  // ============================================
  if (isPartner && partner) {
    const [stats, team, withdrawals] = await Promise.all([
      getAffiliateStats(userData.id),
      getTeam(userData.id),
      getWithdrawalHistory(userData.id),
    ])

    const daysRemaining = partner.endDate
      ? Math.ceil((new Date(partner.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0

    // หา withdrawal ล่าสุดที่ยังไม่เสร็จ
    const pendingWithdrawal = withdrawals.find(w => w.status === 'PENDING' || w.status === 'APPROVED')

    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Partner Dashboard</h1>

        {/* แสดงสถานะการถอนเงินที่กำลังดำเนินการ */}
        {pendingWithdrawal && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-blue-900">กำลังดำเนินการถอนเงิน</p>
                  <p className="text-sm text-blue-700">
                    ฿{(pendingWithdrawal.amount / 100).toLocaleString()} • {pendingWithdrawal.status === 'PENDING' ? 'รอตรวจสอบข้อมูล' : 'กำลังโอนเงิน'}
                  </p>
                </div>
              </div>
              <WithdrawalStatusBadge status={pendingWithdrawal.status} />
            </div>
          </div>
        )}

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
                {userData.referralCode}
              </code>
              <CopyButton code={userData.referralCode} />
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
              userPhone={userData.phone}
              lockedPhone={partner.withdrawPhone}
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

        {/* Withdrawal History */}
        {withdrawals.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">ประวัติการถอนเงิน</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium text-gray-600">วันที่</th>
                    <th className="text-left p-3 font-medium text-gray-600">จำนวน</th>
                    <th className="text-left p-3 font-medium text-gray-600">บัญชี</th>
                    <th className="text-left p-3 font-medium text-gray-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-600">
                        {new Date(w.createdAt).toLocaleDateString('th-TH')}
                      </td>
                      <td className="p-3 font-semibold text-gray-900">
                        ฿{(w.amount / 100).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <p className="text-gray-900">{w.bankCode}</p>
                        <p className="text-xs text-gray-500">{w.accountNumber}</p>
                      </td>
                      <td className="p-3">
                        <WithdrawalStatusBadge status={w.status} />
                        {w.status === 'REJECTED' && w.rejectedReason && (
                          <p className="text-xs text-red-500 mt-1">{w.rejectedReason}</p>
                        )}
                        {w.status === 'PAID' && w.paidAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            โอนเมื่อ {new Date(w.paidAt).toLocaleDateString('th-TH')}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
        {PARTNER_PLANS.map((plan) => {
          const totalMonths = plan.months + plan.bonus
          const pricePerMonth = Math.round(plan.price / totalMonths)
          
          return (
            <div 
              key={plan.months} 
              className="bg-white rounded-xl border-2 border-gray-200 p-5 flex flex-col"
            >
              <p className="text-xl font-bold text-gray-900">{plan.months} เดือน</p>
              
              <div className="h-6">
                {plan.bonus > 0 && (
                  <p className="text-sm text-emerald-600">+{plan.bonus} เดือนฟรี</p>
                )}
              </div>
              
              <p className="text-2xl font-bold text-gray-900 my-3">฿{plan.price}</p>
              <p className="text-sm text-gray-400 mb-4">฿{pricePerMonth}/เดือน</p>
              
              <Link
                href={`/partner/checkout?months=${plan.months}`}
                className="mt-auto block w-full py-2 rounded-lg text-center text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
              >
                เลือก
              </Link>
            </div>
          )
        })}
      </div>

      {/* Terms Preview */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">เงื่อนไขการรับ Partner Reward</h2>
        <div className="text-sm text-gray-600 space-y-2">
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