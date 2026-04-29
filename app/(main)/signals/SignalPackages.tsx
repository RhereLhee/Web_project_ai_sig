"use client"

import { useState } from "react"
import { CheckoutModal } from "./CheckoutModal"

export type PlanId = '1m' | '3m' | '6m'

interface Plan {
  id: PlanId
  label: string
  months: number
  bonus: number
  priceBaht: number
  badge?: string
  highlight: boolean
  savingLabel?: string   // e.g. "ประหยัด ฿449/เดือน"
}

// Fixed prices matching server constants in route.ts
const PLAN_3M_BAHT = 1699
const PLAN_6M_BAHT = 3499

function buildPlans(baseBaht: number): Plan[] {
  // Total saving vs buying 1m plans repeatedly + value of bonus months
  const saving3 = baseBaht * 4 - PLAN_3M_BAHT   // vs 4×1m
  const saving6 = baseBaht * 8 - PLAN_6M_BAHT   // vs 8×1m

  return [
    {
      id: '1m',
      label: '1 เดือน',
      months: 1,
      bonus: 0,
      priceBaht: baseBaht,
      highlight: false,
    },
    {
      id: '3m',
      label: '3 เดือน',
      months: 3,
      bonus: 1,
      priceBaht: PLAN_3M_BAHT,
      badge: '⚡ แนะนำ',
      highlight: true,
      savingLabel: saving3 > 0 ? `ประหยัด ฿${saving3.toLocaleString()}` : undefined,
    },
    {
      id: '6m',
      label: '6 เดือน',
      months: 6,
      bonus: 2,
      priceBaht: PLAN_6M_BAHT,
      badge: '🔥 คุ้มสุด',
      highlight: false,
      savingLabel: saving6 > 0 ? `ประหยัด ฿${saving6.toLocaleString()}` : undefined,
    },
  ]
}

const REFERRAL_DISCOUNT_BAHT = 100

const FEATURES = [
  "6 คู่เงิน Real-time ไม่จำกัดสัญญาณ",
  "เสียงแจ้งเตือน + Picture-in-Picture",
  "ใช้ได้ทุกเวลา ไม่มีเวลาจำกัด",
  "ซัพพอร์ต 24/7",
]

interface SignalPackagesProps {
  vipPriceBaht: number
  hasReferral?: boolean
}

export function SignalPackages({ vipPriceBaht, hasReferral = false }: SignalPackagesProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null)
  const plans = buildPlans(vipPriceBaht)

  return (
    <>
      {/* Referral discount banner */}
      {hasReferral && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <span className="text-emerald-600 text-lg">🎁</span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">คุณมีส่วนลดจากรหัสแนะนำ!</p>
            <p className="text-xs text-emerald-600">ลด ฿{REFERRAL_DISCOUNT_BAHT} ทุกแพ็กเกจ (แสดงในขั้นตอนชำระเงิน)</p>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const discountedPrice = hasReferral
            ? plan.priceBaht - REFERRAL_DISCOUNT_BAHT
            : plan.priceBaht

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-xl border-2 transition-all cursor-pointer ${
                plan.highlight
                  ? 'border-emerald-400 shadow-md shadow-emerald-100'
                  : 'border-gray-200 hover:border-emerald-300'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <div className={`p-5 flex-1 flex flex-col ${plan.highlight ? 'bg-emerald-50/30' : 'bg-white'} rounded-xl`}>
                {/* Plan title */}
                <p className="text-sm font-semibold text-gray-700 mb-3">{plan.label}</p>

                {/* Bonus months tag */}
                {plan.bonus > 0 && (
                  <div className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full mb-3 w-fit">
                    🎁 แถมฟรี {plan.bonus} เดือน
                  </div>
                )}

                {/* Total access */}
                {plan.bonus > 0 && (
                  <p className="text-xs text-gray-500 mb-2">ใช้ได้ {plan.months + plan.bonus} เดือน</p>
                )}

                {/* Price */}
                <div className="mb-1">
                  {hasReferral && (
                    <p className="text-xs text-gray-400 line-through">
                      ฿{plan.priceBaht.toLocaleString()}
                    </p>
                  )}
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${plan.highlight ? 'text-emerald-700' : 'text-gray-900'}`}>
                      ฿{discountedPrice.toLocaleString()}
                    </span>
                  </div>
                  {plan.savingLabel && (
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                      ≈ {plan.savingLabel}
                    </p>
                  )}
                  {!plan.savingLabel && (
                    <p className="text-xs text-gray-400 mt-0.5">/ {plan.months} เดือน</p>
                  )}
                </div>

                <div className="flex-1" />

                {/* CTA button */}
                <button
                  className={`mt-4 w-full py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  เลือกแพ็กเกจนี้
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feature list (shared across all plans) */}
      <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      {selectedPlan && (
        <CheckoutModal
          plan={selectedPlan}
          plans={plans}
          hasReferral={hasReferral}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </>
  )
}
