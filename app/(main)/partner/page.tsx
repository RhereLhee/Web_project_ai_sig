// app/(main)/partner/page.tsx
// Partner dashboard + affiliate earnings.
// Partner-purchase gate has been removed: any logged-in user can see this page
// and register bank info for free. Previous price plans / checkout are retired.
import Link from "next/link"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getMinWithdrawSatang } from "@/lib/system-settings"
import { CopyButton } from "./CopyButton"
import { WithdrawButton } from "./WithdrawButton"
import { BankInfoForm } from "./BankInfoForm"

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

  // Balance derived from ledger (source of truth).
  const { getUserAffiliateBalance, getUserLifetimeEarnings } = await import('@/lib/affiliate')
  const pendingBalance = await getUserAffiliateBalance(userId)
  const totalEarned = await getUserLifetimeEarnings(userId)

  return {
    team: teamCount,
    pendingBalance,
    totalEarned,
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
  const hasBankInfo = !!(partner?.bankName && partner?.accountNumber && partner?.accountName)

  // --------------------------------------------
  // No bank info yet → show registration form
  // --------------------------------------------
  if (!hasBankInfo) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Partner</h1>
          <p className="text-gray-500 mt-1">
            ลงทะเบียนบัญชีธนาคารเพื่อเริ่มรับผลตอบแทนจากการแนะนำ (ฟรี ไม่มีค่าสมัคร)
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">บัญชีที่จะใช้รับเงิน</h2>
          <BankInfoForm />
        </div>

        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">เงื่อนไข Partner Reward</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• ผลตอบแทนคำนวณจากการใช้งานจริงของผู้ใช้บริการที่ถูกแนะนำ</p>
            <p>• ระบบไม่มีการรับประกันหรือการันตีรายได้ใดๆ</p>
            <p>• ยอดคงเหลือไม่มีวันหมดอายุและจะไม่ถูกยึด</p>
            <p>• 1 เบอร์โทร = 1 บัญชี (ล็อคอัตโนมัติเมื่อถอนเงินครั้งแรก)</p>
          </div>
          <a
            href="/docs/partner-terms.pdf"
            target="_blank"
            className="inline-block mt-3 text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            อ่านเงื่อนไขฉบับเต็ม
          </a>
        </div>
      </div>
    )
  }

  // --------------------------------------------
  // Bank info present → full dashboard
  // --------------------------------------------
  const [stats, team, withdrawals, minWithdrawSatang] = await Promise.all([
    getAffiliateStats(userData.id),
    getTeam(userData.id),
    getWithdrawalHistory(userData.id),
    getMinWithdrawSatang(),
  ])
  const minWithdrawBaht = minWithdrawSatang / 100

  const pendingWithdrawal = withdrawals.find(w => w.status === 'PENDING' || w.status === 'APPROVED')

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Partner Dashboard</h1>

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

      {/* Row 1: Code + Balance (status card removed — no more subscription expiry) */}
      <div className="grid lg:grid-cols-2 gap-4">
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
              bankName: partner!.bankName,
              accountNumber: partner!.accountNumber,
              accountName: partner!.accountName,
            }}
            userPhone={userData.phone}
            lockedPhone={partner!.withdrawPhone}
            minWithdrawBaht={minWithdrawBaht}
          />
        </div>
      </div>

      {/* Row 2: Bank + Team + Earnings */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Bank Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">บัญชีรับเงิน</h2>
            <Link href="/partner/bank" className="text-xs text-gray-500 hover:text-gray-700 hover:underline">
              แก้ไข
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">ธนาคาร</span>
              <span className="text-gray-900">{partner!.bankName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">เลขบัญชี</span>
              <span className="font-mono text-gray-900">{partner!.accountNumber}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">ชื่อบัญชี</span>
              <span className="text-gray-900">{partner!.accountName}</span>
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
          <p>• ผลตอบแทนคำนวณจากการใช้งานจริงของผู้ใช้บริการที่ถูกแนะนำ</p>
          <p>• ยอดคงเหลือไม่มีวันหมดอายุและจะไม่ถูกยึด</p>
          <p>• ถอนขั้นต่ำ ฿{minWithdrawBaht.toLocaleString()} ดำเนินการภายใน 1-3 วันทำการ</p>
          <p>• 1 เบอร์โทร = 1 บัญชี (ล็อคอัตโนมัติเมื่อถอนเงินครั้งแรก)</p>
        </div>
        <a
          href="/docs/partner-terms.pdf"
          target="_blank"
          className="inline-block mt-3 text-sm text-gray-500 hover:text-gray-700 hover:underline"
        >
          อ่านเงื่อนไขฉบับเต็ม
        </a>
      </div>
    </div>
  )
}
