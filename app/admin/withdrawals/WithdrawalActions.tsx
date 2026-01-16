"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface Props {
  withdrawalId: string
  showPaid?: boolean
}

export function WithdrawalActions({ withdrawalId, showPaid }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleAction = async (action: 'approve' | 'reject' | 'paid') => {
    const confirmMessages = {
      approve: 'อนุมัติการถอนเงินนี้?',
      reject: 'ปฏิเสธการถอนเงินนี้?',
      paid: 'ยืนยันว่าโอนเงินแล้ว?',
    }
    
    if (!confirm(confirmMessages[action])) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/${action}`, {
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

  if (showPaid) {
    return (
      <button
        onClick={() => handleAction('paid')}
        disabled={loading}
        className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
      >
        {loading ? '...' : 'โอนแล้ว'}
      </button>
    )
  }

  return (
    <div className="flex gap-1">
      <button
        onClick={() => handleAction('approve')}
        disabled={loading}
        className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
      >
        อนุมัติ
      </button>
      <button
        onClick={() => handleAction('reject')}
        disabled={loading}
        className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
      >
        ปฏิเสธ
      </button>
    </div>
  )
}
