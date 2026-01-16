"use client"

import { useEffect, useState } from "react"
import { getSocialLink } from "@/lib/config"

interface SignalResult {
  id: string
  symbol: string
  signalType: string
  wonAtLevel: number
  isWin: boolean
  entryTime: string
}

export function TelegramFeed() {
  const [signals, setSignals] = useState<SignalResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSignals() {
      try {
        setLoading(true)
        
        const response = await fetch('/api/trading/recent-signals', {
          cache: 'no-store'
        })

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }

        const data = await response.json()
        
        if (data.signals && data.signals.length > 0) {
          setSignals(data.signals.slice(0, 5))
        }
      } catch (err) {
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()

    // Refresh every 30 seconds
    const interval = setInterval(fetchSignals, 30000)

    return () => clearInterval(interval)
  }, [])

  // Format time from ISO string
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString('th-TH', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    } catch {
      return '--:--'
    }
  }

  // Format symbol name
  const formatSymbol = (symbol: string) => {
    return symbol.replace(/m$/i, '')
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">สัญญาณล่าสุด</h3>
            <p className="text-sm text-gray-500">กำลังโหลด...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-100 animate-pulse h-20 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900">สัญญาณล่าสุด</h3>
          <p className="text-sm text-gray-500">อัปเดตจาก Forward Test</p>
        </div>
      </div>

      {signals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">ยังไม่มีข้อมูลสัญญาณ</p>
          <p className="text-sm text-gray-400 mt-1">รอการเทรดครั้งถัดไป</p>
        </div>
      ) : (
        <div className="space-y-3">
          {signals.map((signal) => (
            <div
              key={signal.id}
              className="bg-gray-50 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-gray-900">{formatSymbol(signal.symbol)}</p>
                <span className="text-xs text-gray-500">{formatTime(signal.entryTime)}</span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Martingale Level</span>
                <span className="text-sm font-semibold text-gray-700">
                  Level {signal.wonAtLevel > 0 ? signal.wonAtLevel : signal.isWin ? 1 : 3}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Result</span>
                <span
                  className={`text-sm font-semibold px-3 py-1 rounded ${
                    signal.isWin
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {signal.isWin ? 'WIN' : 'LOSS'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <a
        href={getSocialLink('telegram')}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full mt-4 px-4 py-2.5 text-center text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
      >
        ดูทั้งหมดใน Telegram
      </a>
    </div>
  )
}
