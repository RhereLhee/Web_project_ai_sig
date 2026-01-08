import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { CheckoutForm } from "./CheckoutForm"

// ============================================
// SIGNAL PLAN CONFIG - ต้องตรงกับ signals/page.tsx
// ============================================
const SIGNAL_CONFIG = {
  basePrice: 2500,
  plans: [
    { months: 1, bonus: 0 },
    { months: 3, bonus: 1 },
    { months: 9, bonus: 3 },
    { months: 12, bonus: 5 },
  ]
}

function getSignalPlan(planSlug: string) {
  // Check if it's a signal plan (format: signal-Xm)
  const match = planSlug.match(/^signal-(\d+)m$/)
  if (!match) return null

  const months = parseInt(match[1])
  const planConfig = SIGNAL_CONFIG.plans.find(p => p.months === months)
  if (!planConfig) return null

  return {
    id: planSlug,
    name: `Signal ${months} เดือน`,
    slug: planSlug,
    finalPrice: SIGNAL_CONFIG.basePrice * months,
    durationMonths: months,
    promoExtraMonths: planConfig.bonus,
    isSignalPlan: true,
  }
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>
}) {
  const payload = await getCurrentUser()
  if (!payload) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  })

  if (!user) redirect("/login")

  const params = await searchParams
  const planSlug = params.plan
  if (!planSlug) redirect("/pricing")

  // Try to get signal plan first
  const signalPlan = getSignalPlan(planSlug)
  
  if (signalPlan) {
    // It's a signal plan
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">ชำระเงิน</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Order Summary */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">รายละเอียด</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">แพ็กเกจ</span>
                <span className="font-medium">{signalPlan.name}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">ประเภท</span>
                <span className="font-medium text-emerald-600">Signal Room</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-600">ระยะเวลา</span>
                <span className="font-medium">{signalPlan.durationMonths} เดือน</span>
              </div>
              
              {signalPlan.promoExtraMonths > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>โบนัส</span>
                  <span className="font-medium">+{signalPlan.promoExtraMonths} เดือนฟรี</span>
                </div>
              )}
              
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold">ยอดรวม</span>
                <span className="text-2xl font-bold text-emerald-600">
                  ฿{signalPlan.finalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <CheckoutForm 
            plan={signalPlan} 
            user={user} 
            isSignalPlan={true}
          />
        </div>
      </div>
    )
  }

  // Try to get regular plan from DB
  const plan = await prisma.plan.findUnique({
    where: { slug: planSlug },
  })

  if (!plan || !plan.isActive) {
    redirect("/pricing")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ชำระเงิน</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Order Summary */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-4">รายละเอียด</h2>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">แพ็กเกจ</span>
              <span className="font-medium">{plan.name}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">ระยะเวลา</span>
              <span className="font-medium">{plan.durationMonths} เดือน</span>
            </div>
            
            {plan.promoExtraMonths > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>โบนัส</span>
                <span className="font-medium">+{plan.promoExtraMonths} เดือนฟรี</span>
              </div>
            )}
            
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="font-semibold">ยอดรวม</span>
              <span className="text-2xl font-bold text-emerald-600">
                ฿{plan.finalPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <CheckoutForm 
          plan={plan} 
          user={user} 
          isSignalPlan={false}
        />
      </div>
    </div>
  )
}