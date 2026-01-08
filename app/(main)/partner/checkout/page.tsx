import { getUserWithSubscription } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PartnerCheckoutForm } from "./PartnerCheckoutForm"

const PARTNER_PLANS = [
  { months: 1, price: 200, bonus: 0 },
  { months: 3, price: 600, bonus: 0 },
  { months: 6, price: 1200, bonus: 1 },
  { months: 12, price: 2400, bonus: 2 },
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
      <div className="card bg-purple-50 border-purple-200 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-purple-700 text-sm">แพ็กเกจที่เลือก</p>
            <p className="text-xl font-bold text-purple-900">
              {plan.months} เดือน
              {plan.bonus > 0 && <span className="text-emerald-600 text-sm ml-2">+{plan.bonus} ฟรี!</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-purple-900">฿{plan.price}</p>
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