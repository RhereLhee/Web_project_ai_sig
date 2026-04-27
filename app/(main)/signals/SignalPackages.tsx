"use client"

import { useState } from "react"
import { CheckoutModal } from "./CheckoutModal"

interface SignalPackagesProps {
  /** Current VIP price in baht — fetched server-side from getVipPriceSatang(). */
  vipPriceBaht: number
}

export function SignalPackages({ vipPriceBaht }: SignalPackagesProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="bg-white rounded-xl border-2 border-emerald-200 hover:border-emerald-400 transition-colors p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-5">
        {/* Left: title + price */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <h3 className="text-lg font-bold text-gray-900">VIP</h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
              แนะนำ
            </span>
          </div>

          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl md:text-4xl font-bold text-gray-900">
              ฿{vipPriceBaht.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500">/ เดือน</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">ใช้งานได้ 30 วัน · ต่ออายุได้</p>
        </div>

        {/* Middle: features */}
        <ul className="flex-1 space-y-1.5 text-sm text-gray-700">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>6 คู่เงิน Real-time</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>เสียงแจ้งเตือน + Picture-in-Picture</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>ไม่มีเวลาจำกัด ไม่จำกัดสัญญาณ</span>
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span>ซัพพอร์ต 24/7</span>
          </li>
        </ul>

        {/* Right: CTA */}
        <div className="md:w-44">
          <button
            onClick={() => setOpen(true)}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors"
          >
            สมัคร VIP
          </button>
        </div>
      </div>

      {open && (
        <CheckoutModal
          priceBaht={vipPriceBaht}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
