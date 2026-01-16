"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface Props {
  orderId: string
  orderType: string
}

export function ApproveOrderButton({ orderId, orderType }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleApprove = async () => {
    if (!confirm(`ยืนยันการอนุมัติออเดอร์ ${orderType} นี้?`)) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/approve`, {
        method: 'POST',
      })
      
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
    >
      {loading ? '...' : 'อนุมัติ'}
    </button>
  )
}
