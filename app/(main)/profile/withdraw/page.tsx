// app/(main)/profile/withdraw/page.tsx
// Withdrawal page — no Partner/Signal gate. Anyone with bank info + balance can withdraw.
import { getUserWithSubscription } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getUserAffiliateBalance, getUserLifetimeEarnings } from "@/lib/affiliate"
import { getMinWithdrawSatang } from "@/lib/system-settings"
import { WithdrawForm } from "./WithdrawForm"

async function getWithdrawStats(userId: string) {
  const [available, total, recentWithdrawals] = await Promise.all([
    getUserAffiliateBalance(userId),
    getUserLifetimeEarnings(userId),
    prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return {
    available,
    total,
    recentWithdrawals,
  }
}

export default async function WithdrawPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const stats = await getWithdrawStats(user.id)
  const availableBalance = stats.available / 100 // สตางค์ → บาท
  // Min withdraw is configurable via SystemSetting (default 30000 satang = ฿300).
  const minWithdrawSatang = await getMinWithdrawSatang()
  const minWithdraw = minWithdrawSatang / 100

  // Bank info presence check (no gate by subscription anymore).
  const hasBankInfo = !!(user.partner?.bankName && user.partner?.accountNumber && user.partner?.accountName)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ถอนเงิน</h1>

      {/* Balance Card */}
      <div className="card bg-gradient-to-br from-emerald-500 to-cyan-600 text-white">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-emerald-100 text-sm mb-1">ยอดคงเหลือ</p>
            <p className="text-4xl font-bold">฿{availableBalance.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-emerald-100 text-sm mb-1">รายได้รวมทั้งหมด</p>
            <p className="text-2xl font-bold">฿{(stats.total / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Missing bank info */}
      {!hasBankInfo && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-2">ยังไม่ได้ลงทะเบียนบัญชีธนาคาร</h3>
              <p className="text-sm text-yellow-700 mb-3">
                ไปที่หน้า Partner เพื่อลงทะเบียนบัญชีธนาคารที่จะใช้รับเงิน (ฟรี ไม่ต้องสมัครสมาชิก)
              </p>
              <Link href="/partner" className="btn btn-primary btn-sm">
                ลงทะเบียนบัญชีธนาคาร
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Minimum Withdraw Warning */}
      {hasBankInfo && availableBalance < minWithdraw && (
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3">
            <div>
              <h3 className="font-semibold text-orange-800 mb-1">ยอดเงินไม่ถึงขั้นต่ำ</h3>
              <p className="text-sm text-orange-700">
                ยอดคงเหลือขั้นต่ำในการถอนคือ <strong>฿{minWithdraw}</strong>
                <br />
                คุณมียอดคงเหลือ <strong>฿{availableBalance}</strong> ต้องมีอีก <strong>฿{(minWithdraw - availableBalance).toFixed(2)}</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Form */}
      {hasBankInfo && availableBalance >= minWithdraw && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">แบบฟอร์มถอนเงิน</h2>
          <WithdrawForm
            userId={user.id}
            availableBalance={availableBalance}
            minWithdraw={minWithdraw}
          />
        </div>
      )}

      {/* Recent Withdrawals */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">ประวัติการถอน</h2>

        {stats.recentWithdrawals.length === 0 ? (
          <p className="text-gray-500 text-center py-6">ยังไม่มีประวัติการถอน</p>
        ) : (
          <div className="space-y-2">
            {stats.recentWithdrawals.map((withdraw) => (
              <div key={withdraw.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">฿{(withdraw.amount / 100).toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    {withdraw.accountName} - {withdraw.accountNumber}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(withdraw.createdAt).toLocaleDateString('th-TH')}
                  </p>
                </div>
                <span className={`badge ${
                  withdraw.status === 'PENDING' ? 'badge-warning' :
                  withdraw.status === 'APPROVED' ? 'badge-success' :
                  withdraw.status === 'PAID' ? 'badge-info' :
                  'badge-error'
                }`}>
                  {withdraw.status === 'PENDING' ? 'รอดำเนินการ' :
                   withdraw.status === 'APPROVED' ? 'อนุมัติแล้ว' :
                   withdraw.status === 'PAID' ? 'จ่ายแล้ว' :
                   'ปฏิเสธ'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">หมายเหตุ</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• ขั้นต่ำในการถอนคือ ฿{minWithdraw} ต่อครั้ง</li>
          <li>• ต้องมีบัญชีธนาคารลงทะเบียนไว้ล่วงหน้า</li>
          <li>• ระยะเวลาดำเนินการ 1-3 วันทำการ</li>
          <li>• ไม่มีค่าธรรมเนียมการถอน</li>
        </ul>
      </div>
    </div>
  )
}
