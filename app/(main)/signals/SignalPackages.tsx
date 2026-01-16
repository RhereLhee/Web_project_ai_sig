"use client"

import { useState } from "react"
import { CheckoutModal } from "./CheckoutModal"

interface Plan {
  months: number
  price: number
  bonus: number
}

interface SignalPackagesProps {
  plans: Plan[]
  hasReferral: boolean
  referralDiscount: number
}

export function SignalPackages({ plans, hasReferral, referralDiscount }: SignalPackagesProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  return (
    <>
      {/* Referral Discount Banner */}
      {hasReferral && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-emerald-800">คุณได้รับส่วนลดจากรหัสแนะนำ</p>
              <p className="text-sm text-emerald-600">ลด ฿{referralDiscount.toLocaleString()} สำหรับทุกแพ็คเกจ</p>
            </div>
          </div>
        </div>
      )}

      {/* Packages Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {plans.map((plan) => {
          const originalPrice = plan.price
          const finalPrice = hasReferral ? plan.price - referralDiscount : plan.price
          const totalMonths = plan.months + plan.bonus
          const pricePerMonth = Math.round(finalPrice / totalMonths)
          const savingsPercent = plan.months > 1 ? Math.round((1 - pricePerMonth / 2500) * 100) : 0
          
          return (
            <div
              key={plan.months}
              className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 hover:border-gray-300 transition-all flex flex-col"
            >
              {/* Content */}
              <div className="p-4 md:p-5 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg 
                        className="w-5 h-5 text-gray-600"
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M13 10V3L4 14h7v7l9-11h-7z" 
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {plan.months} เดือน
                      </h3>
                      <p className="text-xs text-gray-500">
                        ใช้ได้ {totalMonths} เดือน
                      </p>
                    </div>
                  </div>

                  {/* Bonus Badge */}
                  {plan.bonus > 0 && (
                    <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-1 rounded">
                      +{plan.bonus} ฟรี
                    </span>
                  )}
                </div>

                {/* Price Section */}
                <div className="mb-4">
                  {hasReferral ? (
                    <>
                      <div className="flex items-center space-x-2">
                        <p className="text-2xl font-bold text-gray-900">
                          ฿{finalPrice.toLocaleString()}
                        </p>
                        <span className="text-sm text-gray-400 line-through">
                          ฿{originalPrice.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-600 mt-1">
                        ประหยัด ฿{referralDiscount.toLocaleString()}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900">
                      ฿{originalPrice.toLocaleString()}
                    </p>
                  )}

                  {plan.months > 1 && (
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">
                        เฉลี่ย ฿{pricePerMonth.toLocaleString()}/เดือน
                      </p>
                      {savingsPercent > 0 && (
                        <p className="text-xs text-emerald-600 font-medium">
                          ประหยัด {savingsPercent}%
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>AI Signal Real-time</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>แจ้งเตือน Telegram</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>ซัพพอร์ต 24/7</span>
                  </div>
                </div>

                {/* Button */}
                <div className="mt-auto">
                  <button
                    onClick={() => setSelectedPlan(plan)}
                    className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-semibold text-sm transition-colors"
                  >
                    ซื้อแพ็คเกจ
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Checkout Modal */}
      {selectedPlan && (
        <CheckoutModal
          plan={selectedPlan}
          hasReferral={hasReferral}
          referralDiscount={referralDiscount}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </>
  )
}