// app/(main)/partner/checkout/page.tsx
import { getUserWithSubscription } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PartnerCheckoutForm } from "./PartnerCheckoutForm"

// ราคาใหม่ 199 บาท
const PARTNER_PLANS = [
  { months: 1, price: 199, bonus: 0 },
  { months: 3, price: 499, bonus: 1 },
  { months: 6, price: 899, bonus: 2 },
  { months: 12, price: 1499, bonus: 3 },
]

interface Props {
  searchParams: Promise<{ months?: string }>
}

export default async function PartnerCheckoutPage({ searchParams }: Props) {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const params = await searchParams
  const months = parseInt(params.months || '1')
  
  const plan = PARTNER_PLANS.find(p => p.months === months) || PARTNER_PLANS[0]

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">สมัคร Partner</h1>

      {/* Selected Plan */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-500 text-sm">แพ็คเกจที่เลือก</p>
            <p className="text-xl font-bold text-gray-900">
              {plan.months} เดือน
              {plan.bonus > 0 && <span className="text-emerald-600 text-sm ml-2">+{plan.bonus} ฟรี</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">฿{plan.price}</p>
            {plan.months > 1 && (
              <p className="text-xs text-gray-400">
                เฉลี่ย ฿{Math.round(plan.price / (plan.months + plan.bonus))}/เดือน
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Checkout Form */}
      <PartnerCheckoutForm 
        userId={user.id}
        months={plan.months}
        bonus={plan.bonus}
        price={plan.price}
      />
    </div>
  )
}