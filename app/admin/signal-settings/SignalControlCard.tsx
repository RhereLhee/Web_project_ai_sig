// app/admin/signal-settings/SignalControlCard.tsx
"use client"

import { useState } from "react"

interface SignalData {
  symbol: string
  enabled: boolean
  threshold: number
  notes?: string
  total_sequences: number
  winning_sequences: number
  losing_sequences: number
  win_rate: number
  won_at_level_1: number
  won_at_level_2: number
  won_at_level_3: number
}

interface SignalControlCardProps {
  data: SignalData
}

export function SignalControlCard({ data }: SignalControlCardProps) {
  const [enabled, setEnabled] = useState(data.enabled)
  const [threshold, setThreshold] = useState(data.threshold)
  const [loading, setLoading] = useState(false)
  const [retraining, setRetraining] = useState(false)
  const [message, setMessage] = useState("")

  const handleToggle = async () => {
    setLoading(true)
    setMessage("")
    
    try {
      const res = await fetch('/api/trading/symbols', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.symbol,
          enabled: !enabled,
        }),
      })

      if (res.ok) {
        setEnabled(!enabled)
        setMessage(enabled ? '❌ ปิด Signal แล้ว' : '✅ เปิด Signal แล้ว')
      } else {
        setMessage('⚠️ ไม่สามารถเปลี่ยนสถานะได้')
      }
    } catch (error) {
      setMessage('⚠️ เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(""), 3000)
    }
  }

  const handleRetrain = async () => {
    if (!confirm(`ยืนยันการ Retrain ${data.symbol}?\n\nการ Retrain จะใช้เวลาประมาณ 10-30 นาที`)) {
      return
    }

    setRetraining(true)
    setMessage("")

    try {
      const res = await fetch('/api/trading/retrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: data.symbol }),
      })

      const result = await res.json()

      if (res.ok && result.success) {
        setMessage(`🔄 เริ่ม Retrain ${data.symbol} แล้ว`)
        // Keep animation for 5 seconds to show progress
        setTimeout(() => {
          setRetraining(false)
        }, 5000)
      } else {
        setRetraining(false)
        setMessage(`⚠️ ${result.error || 'ไม่สามารถส่งคำสั่ง Retrain ได้'}`)
      }
    } catch (error) {
      setRetraining(false)
      setMessage('⚠️ ไม่สามารถเชื่อมต่อ Server ได้')
    }
  }

  const handleThresholdChange = async (newThreshold: number) => {
    setThreshold(newThreshold)
    
    try {
      await fetch('/api/trading/symbols', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: data.symbol,
          threshold: newThreshold,
        }),
      })
    } catch (error) {
      console.error('Failed to update threshold')
    }
  }

  const getSymbolCode = (symbol: string): string => {
    const codes: Record<string, string> = {
      'AUDUSDm': 'AUUS',
      'EURUSDm': 'EUUS',
      'GBPUSDm': 'GBUS',
      'USDJPYm': 'USJP',
    }
    return codes[symbol] || symbol.slice(0, 4)
  }

  const formatSymbol = (symbol: string): string => {
    const clean = symbol.replace(/m$/i, '')
    return `${clean.slice(0, 3)}/${clean.slice(3)}`
  }

  return (
    <div className={`bg-white rounded-lg border-2 p-6 transition relative overflow-hidden ${
      enabled ? 'border-emerald-200' : 'border-red-200 opacity-75'
    }`}>
      
      {/* Retrain Animation Overlay */}
      {retraining && (
        <div className="absolute inset-0 z-30 bg-blue-900/95 flex flex-col items-center justify-center">
          {/* Animated Brain/AI Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-800 flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-300 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            {/* Spinning ring */}
            <div className="absolute inset-0 w-20 h-20 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            {/* Outer pulse ring */}
            <div className="absolute -inset-2 w-24 h-24 border-2 border-blue-500/50 rounded-full animate-ping"></div>
          </div>
          
          {/* Progress dots */}
          <div className="flex space-x-2 mb-4">
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-3 h-3 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          
          <p className="text-white text-lg font-semibold mb-2">
            กำลัง Retrain AI Model
          </p>
          <p className="text-blue-300 text-sm">
            {formatSymbol(data.symbol)}
          </p>
          <p className="text-blue-400/70 text-xs mt-3">
            กรุณารอสักครู่...
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-bold text-gray-400">{getSymbolCode(data.symbol)}</span>
          <div>
            <h3 className="font-bold text-lg">{formatSymbol(data.symbol)}</h3>
            <p className="text-sm text-gray-500">{data.symbol}</p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          disabled={loading || retraining}
          className={`relative w-14 h-7 rounded-full transition ${
            enabled ? 'bg-emerald-500' : 'bg-gray-300'
          } ${(loading || retraining) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'left-8' : 'left-1'
          }`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className={`text-lg font-bold ${data.win_rate >= 90 ? 'text-emerald-600' : data.win_rate >= 85 ? 'text-yellow-600' : 'text-red-500'}`}>
            {data.win_rate.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500">Win Rate</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-green-600">{data.winning_sequences}</p>
          <p className="text-xs text-gray-500">Wins</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-red-500">{data.losing_sequences}</p>
          <p className="text-xs text-gray-500">Losses</p>
        </div>
      </div>

      {/* Win Level Distribution */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Win Distribution</p>
        <div className="flex space-x-2">
          <div className="flex-1 bg-emerald-100 rounded p-2 text-center">
            <p className="text-sm font-bold text-emerald-700">{data.won_at_level_1}</p>
            <p className="text-xs text-emerald-600">L1</p>
          </div>
          <div className="flex-1 bg-yellow-100 rounded p-2 text-center">
            <p className="text-sm font-bold text-yellow-700">{data.won_at_level_2}</p>
            <p className="text-xs text-yellow-600">L2</p>
          </div>
          <div className="flex-1 bg-orange-100 rounded p-2 text-center">
            <p className="text-sm font-bold text-orange-700">{data.won_at_level_3}</p>
            <p className="text-xs text-orange-600">L3</p>
          </div>
        </div>
      </div>

      {/* Threshold Slider */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm text-gray-600">Threshold</label>
          <span className="text-sm font-medium text-emerald-600">{(threshold * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.70"
          max="0.95"
          step="0.01"
          value={threshold}
          onChange={(e) => handleThresholdChange(parseFloat(e.target.value))}
          disabled={retraining}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>70%</span>
          <span>95%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-2">
        <button
          onClick={handleRetrain}
          disabled={retraining || loading}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition flex items-center justify-center space-x-2 ${
            retraining
              ? 'bg-blue-100 text-blue-400 cursor-not-allowed'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          {retraining ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>กำลัง Retrain...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Retrain</span>
            </>
          )}
        </button>

        <button
          onClick={handleToggle}
          disabled={loading || retraining}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
            enabled
              ? 'bg-red-50 text-red-600 hover:bg-red-100'
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
          } ${(loading || retraining) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {enabled ? '🔴 ปิด Signal' : '🟢 เปิด Signal'}
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mt-3 p-2 rounded-lg text-sm text-center ${
          message.includes('✅') || message.includes('🔄') 
            ? 'bg-emerald-50 text-emerald-700' 
            : message.includes('❌')
            ? 'bg-red-50 text-red-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          {message}
        </div>
      )}

      {/* Disabled Warning */}
      {!enabled && !retraining && (
        <div className="mt-3 p-2 bg-yellow-50 rounded-lg">
          <p className="text-xs text-yellow-700 text-center">
            ⚠️ Signal ถูกปิด - ไม่แสดงในหน้า Signal Room
          </p>
        </div>
      )}
    </div>
  )
}