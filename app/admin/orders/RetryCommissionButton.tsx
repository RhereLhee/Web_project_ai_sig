'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RetryCommissionButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleRetry = async () => {
    if (!confirm('แจก commission ให้ upline ของออเดอร์นี้ใช่ไหม?')) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/distribute-commission`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) {
        setResult(`ไม่สำเร็จ: ${data.error}`)
      } else {
        setResult(`แจกแล้ว ${data.distributed} คน · ยอดรวม ฿${(data.totalPaid / 100).toFixed(2)}`)
        router.refresh()
      }
    } catch {
      setResult('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors disabled:opacity-50"
      >
        {loading ? 'กำลังแจก...' : 'แจก Commission'}
      </button>
      {result && (
        <span className="text-xs text-gray-600">{result}</span>
      )}
    </div>
  )
}
