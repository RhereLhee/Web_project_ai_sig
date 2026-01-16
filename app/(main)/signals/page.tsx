// app/(main)/signals/page.tsx
import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignalRoomContent } from "@/components/SignalRoomContent"
import { SignalPackages } from "./SignalPackages"
import { prisma } from "@/lib/prisma"

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

export default async function SignalsPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const hasSignal = hasSignalAccess(user)

  // เช็คว่ามี referral หรือไม่
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { referredById: true },
  })
  const hasReferral = !!fullUser?.referredById

  // ============================================
  // ถ้ายังไม่มี Signal → แสดงหน้าซื้อแพ็คเกจ
  // ============================================
  if (!hasSignal) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room</h1>
          <p className="text-sm text-gray-500 mt-1">เลือกแพ็คเกจเพื่อเข้าถึงสัญญาณเทรด AI</p>
        </div>

        {/* Packages */}
        <SignalPackages 
          plans={SIGNAL_PLANS} 
          hasReferral={hasReferral}
          referralDiscount={REFERRAL_DISCOUNT}
        />

        {/* FAQ */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h2 className="font-semibold text-gray-900 mb-4">คำถามที่พบบ่อย</h2>
          <div className="space-y-4">
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

  // ============================================
  // ถ้ามี Signal แล้ว → แสดง Signal Room
  // ============================================
  return <SignalRoomContent user={user as any} />
}