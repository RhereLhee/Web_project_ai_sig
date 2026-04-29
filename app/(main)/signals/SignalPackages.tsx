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
}

// Fixed prices matching server constants in route.ts
const PLAN_3M_BAHT = 1699
const PLAN_6M_BAHT = 3499
const REFERRAL_DISCOUNT_BAHT = 100

function buildPlans(baseBaht: number): Plan[] {
  return [
    { id: '1m', label: '1 เดือน',  months: 1, bonus: 0, priceBaht: baseBaht },
    { id: '3m', label: '3 เดือน',  months: 3, bonus: 1, priceBaht: PLAN_3M_BAHT },
    { id: '6m', label: '6 เดือน',  months: 6, bonus: 2, priceBaht: PLAN_6M_BAHT },
  ]
}

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
      {/* Referral notice */}
      {hasReferral && (
        <div className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          ส่วนลดลิงก์แนะนำ <span className="font-semibold">฿{REFERRAL_DISCOUNT_BAHT}</span> ถูกหักออกจากราคาด้านล่างแล้ว
        </div>
      )}

      {/* Plan cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const totalMonths   = plan.months + plan.bonus
          // full value = buying at monthly rate for the same total months
          const valuePrice    = vipPriceBaht * totalMonths
          const finalPrice    = plan.priceBaht - (hasReferral ? REFERRAL_DISCOUNT_BAHT : 0)
          const savePct       = Math.round((1 - finalPrice / valuePrice) * 100)
          const perMonth      = Math.round(finalPrice / totalMonths)
          const hasDiscount   = savePct > 0

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className="relative flex flex-col rounded-xl border border-emerald-200 bg-white p-5 cursor-pointer hover:border-emerald-400 hover:shadow-sm transition-all"
            >
              {/* Discount badge */}
              {hasDiscount && (
                <span className="absolute top-4 right-4 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  -{savePct}%
                </span>
              )}

              {/* Plan name */}
              <p className="text-sm font-semibold text-gray-900 mb-1">{plan.label}</p>

              {/* Bonus info */}
              {plan.bonus > 0 ? (
                <p className="text-xs text-gray-400 mb-4">
                  แถม {plan.bonus} เดือน · ใช้ได้ {totalMonths} เดือน
                </p>
              ) : (
                <div className="mb-4" />
              )}

              {/* Pricing */}
              <div className="mb-5">
                {hasDiscount && (
                  <p className="text-xs text-gray-400 line-through mb-0.5">
                    ฿{valuePrice.toLocaleString()}
                  </p>
                )}
                <p className="text-3xl font-bold text-gray-900 tracking-tight">
                  ฿{finalPrice.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  ≈ ฿{perMonth.toLocaleString()} / เดือน
                </p>
              </div>

              <div className="flex-1" />

              {/* CTA */}
              <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white transition-colors">
                เลือก
              </button>
            </div>
          )
        })}
      </div>

      {/* Features */}
      <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-2">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-500">
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
