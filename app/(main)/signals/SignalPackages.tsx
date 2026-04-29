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
  highlight: boolean
}

// Fixed prices matching server constants in route.ts
const PLAN_3M_BAHT = 1699
const PLAN_6M_BAHT = 3499

function buildPlans(baseBaht: number): Plan[] {
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
      highlight: true,
    },
    {
      id: '6m',
      label: '6 เดือน',
      months: 6,
      bonus: 2,
      priceBaht: PLAN_6M_BAHT,
      highlight: false,
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
      {/* Referral discount notice */}
      {hasReferral && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <p className="text-sm text-emerald-800">
            คุณมีส่วนลด <span className="font-semibold">฿{REFERRAL_DISCOUNT_BAHT}</span> จากการสมัครผ่านลิงก์แนะนำ
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid sm:grid-cols-3 gap-3">
        {plans.map((plan) => {
          const discountedPrice = hasReferral
            ? plan.priceBaht - REFERRAL_DISCOUNT_BAHT
            : plan.priceBaht
          const totalMonths = plan.months + plan.bonus

          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`flex flex-col rounded-xl border-2 p-5 cursor-pointer transition-all ${
                plan.highlight
                  ? 'border-emerald-400 bg-white'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <p className="text-sm font-medium text-gray-700 mb-3">{plan.label}</p>

              {plan.bonus > 0 && (
                <p className="text-xs text-gray-500 mb-3">
                  แถม {plan.bonus} เดือน · ใช้ได้ {totalMonths} เดือน
                </p>
              )}

              <div className="mb-4">
                {hasReferral && (
                  <p className="text-xs text-gray-400 line-through mb-0.5">
                    ฿{plan.priceBaht.toLocaleString()}
                  </p>
                )}
                <p className="text-2xl font-bold text-gray-900">
                  ฿{discountedPrice.toLocaleString()}
                </p>
              </div>

              <div className="flex-1" />

              <button
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  plan.highlight
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                เลือก
              </button>
            </div>
          )
        })}
      </div>

      {/* Features */}
      <ul className="mt-5 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
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
