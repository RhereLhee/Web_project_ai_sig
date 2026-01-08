import { getUserWithSubscription, hasActiveSubscription, hasSignalAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { WithdrawForm } from "./WithdrawForm"

async function getWithdrawStats(userId: string) {
  const [pendingAmount, totalCommission, recentWithdrawals] = await Promise.all([
    prisma.commission.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return {
    available: pendingAmount._sum.amount || 0,
    total: totalCommission._sum.amount || 0,
    recentWithdrawals,
  }
}

export default async function WithdrawPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const hasSub = hasActiveSubscription(user)
  const hasSignal = hasSignalAccess(user)
  const stats = await getWithdrawStats(user.id)

  // เช็คเงื่อนไขการถอน
  const canWithdraw = hasSub && hasSignal
  const availableBalance = stats.available / 100 // แปลงเป็นบาท
  const minWithdraw = 350

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">💰 ถอนเงิน</h1>

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

      {/* Withdrawal Conditions */}
      {!canWithdraw && (
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start space-x-3">
            <span className="text-3xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-2">เงื่อนไขการถอนเงิน</h3>
              <p className="text-sm text-yellow-700 mb-3">
                คุณต้องมีทั้ง <strong>Signal Access</strong> และ <strong>PRO Subscription</strong> ถึงจะถอนเงินได้
              </p>
              
              <div className="space-y-2 mb-4">
                <div className={`flex items-center space-x-2 ${hasSignal ? 'text-green-700' : 'text-red-700'}`}>
                  <span>{hasSignal ? '✅' : '❌'}</span>
                  <span className="text-sm">Signal Access</span>
                </div>
                <div className={`flex items-center space-x-2 ${hasSub ? 'text-green-700' : 'text-red-700'}`}>
                  <span>{hasSub ? '✅' : '❌'}</span>
                  <span className="text-sm">PRO Subscription</span>
                </div>
              </div>
              
              <Link href="/pricing" className="btn btn-primary btn-sm">
                ดูแพ็กเกจ
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Minimum Withdraw Warning */}
      {canWithdraw && availableBalance < minWithdraw && (
        <div className="card bg-orange-50 border-orange-200">
          <div className="flex items-start space-x-3">
            <span className="text-2xl">💡</span>
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
      {canWithdraw && availableBalance >= minWithdraw && (
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
                    {withdraw.bankName} - {withdraw.accountNumber}
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
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ หมายเหตุ</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• ขั้นต่ำในการถอนคือ ฿{minWithdraw} ต่อครั้ง</li>
          <li>• ต้องมีทั้ง Signal Access และ PRO Subscription</li>
          <li>• ระยะเวลาดำเนินการ 1-3 วันทำการ</li>
          <li>• ไม่มีค่าธรรมเนียมการถอน</li>
        </ul>
      </div>
    </div>
  )
}