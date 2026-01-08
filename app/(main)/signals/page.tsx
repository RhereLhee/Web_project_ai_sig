import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { redirect } from "next/navigation"
import Image from "next/image"
import { SignalRoomContent } from "@/components/SignalRoomContent"
import { BuySignalButton } from "./BuySignalButton"

// ============================================
// SIGNAL PLAN CONFIG - Easy to scale
// ============================================
const SIGNAL_CONFIG = {
  basePrice: 2500, // ราคา base ต่อเดือน (บาท)
  baseName: "Signal",
  plans: [
    { months: 1, bonus: 0 },
    { months: 3, bonus: 1 },
    { months: 9, bonus: 3 },
    { months: 12, bonus: 5 },
  ]
}

// Generate plans from config
function generateSignalPlans() {
  return SIGNAL_CONFIG.plans.map((plan) => ({
    id: `signal-${plan.months}m`,
    name: `${plan.months} เดือน`,
    price: SIGNAL_CONFIG.basePrice * plan.months,
    months: plan.months,
    bonus: plan.bonus,
    totalMonths: plan.months + plan.bonus,
    image: `/packages/signal-${plan.months}m.png`,
  }))
}

export default async function SignalsPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const hasSignal = hasSignalAccess(user)
  
  if (!hasSignal) {
    const signalPlans = generateSignalPlans()

    return (
      <div className="space-y-4 md:space-y-6">
        {/* Header Bar */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room</h1>
          <p className="text-sm text-gray-500">เลือกแพ็กเกจเพื่อเข้าถึงสัญญาณเทรด AI</p>
        </div>

        {/* Packages Grid - 2 cols mobile, 4 cols desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {signalPlans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow flex flex-col"
            >
              {/* Image Placeholder */}
              <div className="aspect-[4/3] bg-gray-800 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-8 h-8 md:w-12 md:h-12 text-gray-600 mx-auto mb-1 md:mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-gray-400 text-[10px] md:text-xs">Signal Package</p>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-3 md:p-4 flex-1 flex flex-col">
                {/* Package Name & Duration */}
                <div className="mb-1 md:mb-2">
                  <h3 className="text-base md:text-lg font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-[10px] md:text-xs text-gray-500">
                    ใช้ได้ {plan.totalMonths} เดือน
                    {plan.bonus > 0 && (
                      <span className="text-emerald-600 font-medium"> (+{plan.bonus} ฟรี)</span>
                    )}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-2 md:mb-3">
                  <div className="text-lg md:text-2xl font-bold text-gray-900">
                    ฿{plan.price.toLocaleString()}
                  </div>
                </div>

                {/* Button - ไปหน้า Signal Room เลย */}
                <div className="mt-auto">
                  <BuySignalButton planId={plan.id} months={plan.months} bonus={plan.bonus} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // User has signal access - Show Signal Room
  return <SignalRoomContent user={user} />
}