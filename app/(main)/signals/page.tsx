// app/(main)/signals/page.tsx
//
// Flow:
//   - hasSignalAccess()        → full SignalRoomWithProvider (6 pairs, sound, PiP)
//   - !hasSignal & ?free=1     → FreeSignalRoom (FREE PLAN: EU+UJ, 20:00-21:00, 10/day)
//   - !hasSignal (default)     → packages + a "ดูฟรี" CTA that links to ?free=1
//
// The old auto-Free-Trial that granted price=0 SignalSubscription has been removed —
// it was leaking full Signal Room access to anyone who signed up. Free viewing now
// strictly goes through the gated FreeSignalRoom.
import Link from "next/link"
import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SignalRoomWithProvider } from "@/components/SignalRoomWithProvider"
import { FreeSignalRoom } from "@/components/FreeSignalRoom"
import { SignalPackages } from "./SignalPackages"
import { prisma } from "@/lib/prisma"
import {
  FREE_DAILY_LIMIT,
  FREE_PAIR_DISPLAY,
  FREE_WINDOW_END_HOUR,
  FREE_WINDOW_START_HOUR,
} from "@/lib/free-window"

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
  searchParams: Promise<{ free?: string }>
}

export default async function SignalsPage({ searchParams }: Props) {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const hasSignal = hasSignalAccess(user)

  // ----------------------------------------------------------------
  // 1) Paid users → full Signal Room (unchanged)
  // ----------------------------------------------------------------
  if (hasSignal) {
    return <SignalRoomWithProvider user={user as any} />
  }

  // ----------------------------------------------------------------
  // 2) Free-mode opt-in via ?free=1
  // ----------------------------------------------------------------
  const params = await searchParams
  if (params.free === '1') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/signals"
            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            กลับไปดูแพ็กเกจ
          </Link>
        </div>
        <FreeSignalRoom />
      </div>
    )
  }

  // ----------------------------------------------------------------
  // 3) Default for non-paying users → packages + free CTA
  // ----------------------------------------------------------------
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { referredById: true },
  })
  const hasReferral = !!fullUser?.referredById

  const startStr = String(FREE_WINDOW_START_HOUR).padStart(2, '0')
  const endStr = String(FREE_WINDOW_END_HOUR).padStart(2, '0')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room</h1>
        <p className="text-sm text-gray-500 mt-1">เลือกแพ็กเกจเพื่อเข้าถึงสัญญาณเทรด AI</p>
      </div>

      {/* Free CTA — opt-in entry to FreeSignalRoom */}
      <Link
        href="/signals?free=1"
        className="block bg-gradient-to-br from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 transition-colors rounded-xl shadow-sm p-4 md:p-5 text-white"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white/20 rounded-full text-xs font-semibold">
                FREE
              </span>
              <span className="font-semibold">ลองดูฟรี</span>
            </div>
            <p className="text-xs md:text-sm text-emerald-50">
              ทุกวัน {startStr}:00–{endStr}:00 · {FREE_PAIR_DISPLAY.join(' + ')} · {FREE_DAILY_LIMIT} สัญญาณ/วัน
            </p>
            <p className="text-[11px] md:text-xs text-emerald-100/80 mt-0.5">
              ไม่มีเสียงแจ้งเตือน · ไม่มี Picture-in-Picture
            </p>
          </div>
          <span className="inline-flex items-center gap-1 px-3 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium">
            เข้าดู
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </Link>

      {/* Paid packages */}
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
            <h3 className="font-medium text-gray-900">โหมดฟรีใช้ได้ตอนไหน?</h3>
            <p className="text-sm text-gray-500 mt-1">
              ทุกวัน {startStr}:00–{endStr}:00 (เวลาไทย) เฉพาะคู่ {FREE_PAIR_DISPLAY.join(' และ ')} จำกัด {FREE_DAILY_LIMIT} สัญญาณ/วัน · กด PiP ไม่ได้ · ไม่มีเสียงแจ้งเตือน
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
