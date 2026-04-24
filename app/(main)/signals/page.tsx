// app/(main)/signals/page.tsx
import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignalRoomWithProvider } from "@/components/SignalRoomWithProvider"
import { FreeSignalRoom } from "@/components/FreeSignalRoom"
import { SignalPackages } from "./SignalPackages"
import { prisma } from "@/lib/prisma"
import { isFreeTrial, getFreeTrialDays } from "@/lib/system-settings"
import { logger } from "@/lib/logger"

// ============================================
// SIGNAL PLAN CONFIG
// ============================================
export const SIGNAL_PLANS = [
  { months: 1, price: 2500, bonus: 0 },
  { months: 3, price: 6999, bonus: 1 },
  { months: 6, price: 12999, bonus: 2 },
  { months: 9, price: 19999, bonus: 3 },
]

export const REFERRAL_DISCOUNT = 300

interface Props {
  searchParams: Promise<{ upgrade?: string }>
}

export default async function SignalsPage({ searchParams }: Props) {
  let user = await getUserWithSubscription()
  if (!user) redirect("/login")

  let hasSignal = hasSignalAccess(user)

  // ============================================
  // Auto-grant Free Trial สำหรับ user ที่ยังไม่มี subscription
  // ============================================
  if (!hasSignal) {
    const freeTrialOn = await isFreeTrial()
    if (freeTrialOn) {
      const existingTrial = await prisma.signalSubscription.findFirst({
        where: { userId: user.id, price: 0 },
      })

      if (!existingTrial) {
        const trialDays = await getFreeTrialDays()
        const startDate = new Date()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + trialDays)

        await prisma.signalSubscription.create({
          data: {
            userId: user.id,
            status: 'ACTIVE',
            startDate,
            endDate,
            price: 0,
          },
        })

        logger.info(`Auto Free Trial ${trialDays} วัน: ${user.email}`, {
          context: 'signal',
          userId: user.id,
          metadata: { trialDays, endDate: endDate.toISOString() },
        })

        user = (await getUserWithSubscription())!
        hasSignal = hasSignalAccess(user)
      }
    }
  }

  // ============================================
  // Full Signal Access — unchanged
  // ============================================
  if (hasSignal) {
    return <SignalRoomWithProvider user={user as any} />
  }

  // ============================================
  // No Signal Access → FREE PLAN + purchase packages below it
  // ============================================
  const params = await searchParams
  const showUpgradeOnly = params.upgrade === '1'

  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { referredById: true },
  })
  const hasReferral = !!fullUser?.referredById

  return (
    <div className="space-y-6">
      {/* FREE PLAN live room — gated by 20:00–21:00 + 10/day + EU/UJ only */}
      {!showUpgradeOnly && <FreeSignalRoom />}

      {/* Packages */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h2 className="font-semibold text-gray-900 mb-1">ปลดล็อกแบบเต็ม</h2>
        <p className="text-sm text-gray-500 mb-4">
          ดู 6 คู่เงินตลอดเวลา ไม่มีจำกัด พร้อมเสียงแจ้งเตือนและ Picture-in-Picture
        </p>
        <SignalPackages
          plans={SIGNAL_PLANS}
          hasReferral={hasReferral}
          referralDiscount={REFERRAL_DISCOUNT}
        />
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">คำถามที่พบบ่อย</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">FREE PLAN ใช้ได้ตอนไหน?</h3>
            <p className="text-sm text-gray-500 mt-1">
              เปิดให้ดูฟรีทุกวันเวลา 20:00–21:00 (เวลาไทย) เฉพาะคู่ EURUSD และ USDJPY จำกัด 10 สัญญาณ/วัน
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Signal คืออะไร?</h3>
            <p className="text-sm text-gray-500 mt-1">
              Signal คือสัญญาณเทรดที่ AI วิเคราะห์จากข้อมูลตลาดแบบ Real-time
              บอกจุด Entry และทิศทางที่ควรเทรด
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Win Rate เท่าไหร่?</h3>
            <p className="text-sm text-gray-500 mt-1">
              Win Rate เฉลี่ยอยู่ที่ 82-85% จาก Forward Test จริง
              สามารถดูสถิติย้อนหลังได้หลังสมัคร
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">ใช้งานยากไหม?</h3>
            <p className="text-sm text-gray-500 mt-1">
              ใช้งานง่ายมาก แค่รอ Signal แล้วเทรดตาม
              มีคู่มือและทีมซัพพอร์ตช่วยเหลือตลอด
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
