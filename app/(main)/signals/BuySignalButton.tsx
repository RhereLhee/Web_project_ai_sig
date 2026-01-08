"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface BuySignalButtonProps {
  planId: string
  months: number
  bonus: number
}

export function BuySignalButton({ planId, months, bonus }: BuySignalButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleBuy = async () => {
    setLoading(true)
    
    try {
      // เรียก API เพื่อ activate signal subscription (ข้าม payment ไปก่อน)
      const res = await fetch('/api/signal/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          months,
          bonus,
        }),
      })

      if (res.ok) {
        // Refresh หน้าเพื่อให้ hasSignal = true แล้วแสดง Signal Room
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleBuy}
      disabled={loading}
      className="block w-full text-center py-2 md:py-2.5 px-2 md:px-3 rounded-lg font-semibold text-xs md:text-sm transition-colors bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
    >
      {loading ? 'กำลังดำเนินการ...' : 'ซื้อแพ็กเกจ'}
    </button>
  )
}