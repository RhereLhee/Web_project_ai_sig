// app/admin/signals/QuickActions.tsx
"use client"

import { useState } from "react"

interface QuickActionsProps {
  symbols: string[]
}

export function QuickActions({ symbols }: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<'success' | 'info' | 'error' | null>(null)

  const handleEnableAll = async () => {
    if (!confirm('ยืนยันเปิด Signal ทุกคู่เงิน?')) return

    setLoading('enable')
    setMessage("")
    setMessageType(null)

    try {
      for (const symbol of symbols) {
        await fetch('/api/trading/symbols', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, enabled: true }),
        })
      }
      setMessage('เปิด Signal ทั้งหมดแล้ว')
      setMessageType('success')
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setMessage('เกิดข้อผิดพลาด')
      setMessageType('info')
    } finally {
      setLoading(null)
    }
  }

  const handleDisableAll = async () => {
    if (!confirm('ยืนยันปิด Signal ทุกคู่เงิน?\n\nUsers จะไม่เห็น Signal ใดๆ')) return

    setLoading('disable')
    setMessage("")
    setMessageType(null)

    try {
      for (const symbol of symbols) {
        await fetch('/api/trading/symbols', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, enabled: false }),
        })
      }
      setMessage('ปิด Signal ทั้งหมดแล้ว')
      setMessageType('error')
      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      setMessage('เกิดข้อผิดพลาด')
      setMessageType('info')
    } finally {
      setLoading(null)
    }
  }

  const handleRetrainAll = async () => {
    if (!confirm('ยืนยัน Retrain ทุก Model?\n\nจะใช้เวลาประมาณ 30-60 นาที')) return

    setLoading('retrain')
    setMessage("")
    setMessageType(null)

    try {
      for (const symbol of symbols) {
        await fetch('/api/trading/retrain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol }),
        })
      }
      setMessage('ส่งคำสั่ง Retrain ทั้งหมดแล้ว')
      setMessageType('info')
    } catch (error) {
      setMessage('เกิดข้อผิดพลาด')
      setMessageType('info')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleEnableAll}
          disabled={loading !== null}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            loading === 'enable'
              ? 'bg-gray-100 text-gray-400'
              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
          }`}
        >
          {loading === 'enable' ? 'กำลังดำเนินการ...' : 'เปิดทั้งหมด'}
        </button>

        <button
          onClick={handleDisableAll}
          disabled={loading !== null}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            loading === 'disable'
              ? 'bg-gray-100 text-gray-400'
              : 'bg-red-100 text-red-700 hover:bg-red-200'
          }`}
        >
          {loading === 'disable' ? 'กำลังดำเนินการ...' : 'ปิดทั้งหมด'}
        </button>

        <button
          onClick={handleRetrainAll}
          disabled={loading !== null}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            loading === 'retrain'
              ? 'bg-gray-100 text-gray-400'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {loading === 'retrain' ? 'กำลังดำเนินการ...' : 'Retrain ทั้งหมด'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-3 rounded-lg text-sm ${
          messageType === 'success' || messageType === 'info'
            ? 'bg-emerald-50 text-emerald-700'
            : messageType === 'error'
            ? 'bg-red-50 text-red-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          {message}
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          <strong>Tip:</strong> หากต้องการปรับปรุง Model ทั้งหมด ให้ปิด Signal ก่อน Retrain เปิดเมื่อเสร็จ
        </p>
      </div>
    </div>
  )
}
