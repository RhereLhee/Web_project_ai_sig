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
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleAction = async (action: 'approve' | 'reject' | 'paid', reason?: string) => {
    if (action !== 'reject') {
      const confirmMessages = {
        approve: 'อนุมัติการถอนเงินนี้?',
        paid: 'ยืนยันว่าโอนเงินแล้ว?',
      }
      
      if (!confirm(confirmMessages[action])) return
    }
    
    setLoading(true)
    try {
      const body: any = {}
      if (action === 'reject' && reason) {
        body.reason = reason
      }

      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      if (res.ok) {
        setShowRejectModal(false)
        setRejectReason('')
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

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('กรุณากรอกเหตุผลในการปฏิเสธ')
      return
    }
    handleAction('reject', rejectReason)
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
    <>
      <div className="flex gap-1">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
        >
          อนุมัติ
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
        >
          ปฏิเสธ
        </button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">ปฏิเสธการถอนเงิน</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เหตุผลในการปฏิเสธ <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="เช่น ชื่อบัญชีไม่ตรงกับชื่อผู้ใช้, เลขบัญชีไม่ถูกต้อง..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                เหตุผลนี้จะถูกส่งให้ผู้ใช้ทาง email
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleReject}
                disabled={loading || !rejectReason.trim()}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'กำลังดำเนินการ...' : 'ยืนยันปฏิเสธ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}