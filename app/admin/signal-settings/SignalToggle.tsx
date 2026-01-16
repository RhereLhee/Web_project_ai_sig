"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

interface Props {
  symbol: string
  enabled: boolean
  label?: string
  variant?: 'default' | 'success' | 'danger'
}

export function SignalToggle({ symbol, enabled, label, variant = 'default' }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    const action = symbol === 'ALL' 
      ? (enabled ? 'เปิดทั้งหมด' : 'ปิดทั้งหมด')
      : (enabled ? 'ปิด' : 'เปิด') + ' ' + symbol

    if (!confirm(`ยืนยัน${action}?`)) return
    
    setLoading(true)
    try {
      const res = await fetch('/api/admin/signal-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol, 
          enabled: symbol === 'ALL' ? enabled : !enabled 
        }),
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

  // สำหรับปุ่ม Quick Action
  if (label) {
    const buttonClass = variant === 'success' 
      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
      : variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'

    return (
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${buttonClass}`}
      >
        {loading ? '...' : label}
      </button>
    )
  }

  // สำหรับ Toggle Switch
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`relative w-14 h-7 rounded-full transition-colors disabled:opacity-50 ${
        enabled ? 'bg-emerald-500' : 'bg-gray-300'
      }`}
    >
      <span 
        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-8' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
