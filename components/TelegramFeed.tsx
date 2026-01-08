"use client"

import { useEffect, useState } from "react"
import { getSocialLink } from "@/lib/config"

interface TelegramSignal {
  id: number
  type: 'WIN' | 'LOSS'
  level: number
  pair: string
  time: string
  text: string
}

export function TelegramFeed() {
  const [signals, setSignals] = useState<TelegramSignal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSignals() {
      try {
        setLoading(true)
        console.log('Fetching signals from API...')
        
        const response = await fetch('/api/telegram', {
          cache: 'no-store'
        })

        console.log('API Response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('API Error:', response.status, errorText)
          throw new Error(`API returned ${response.status}`)
        }

        const data = await response.json()
        
        console.log('API Response data:', data)

        if (data.signals && data.signals.length > 0) {
          console.log('✓ Signals found:', data.signals.length)
          setSignals(data.signals.slice(0, 5)) // Show latest 5
        } else {
          console.log('⚠️ No signals, using fallback')
          setSignals(getFallbackSignals())
        }
        setError(null)
      } catch (err) {
        console.error('❌ Fetch error:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setSignals(getFallbackSignals())
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()

    // Refresh every 60 seconds
    const interval = setInterval(fetchSignals, 60000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="card bg-gray-50 border-gray-200">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Telegram Updates</h3>
            <p className="text-sm text-gray-600">กำลังโหลด...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-200 animate-pulse h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card bg-gray-50 border-gray-200">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-gray-900">Telegram Updates</h3>
          <p className="text-sm text-gray-600">
            {error ? 'ใช้ข้อมูลตัวอย่าง' : 'สัญญาณล่าสุด'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start space-x-2">
            <span className="text-yellow-600">⚠️</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-yellow-800">
                ไม่สามารถดึงข้อมูลจาก Telegram
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                {error}
              </p>
              <p className="text-xs text-yellow-600 mt-1">
                กำลังแสดงข้อมูลตัวอย่าง
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900">{signal.pair}</p>
              <span className="text-xs text-gray-500">{signal.time}</span>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-600">Martingale Level</span>
              <span className="text-sm font-semibold text-gray-700">
                Level {signal.level}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Result</span>
              <span
                className={`text-sm font-semibold px-3 py-1 rounded ${
                  signal.type === "WIN"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {signal.type}
              </span>
            </div>
          </div>
        ))}
      </div>

      <a
        href={getSocialLink('telegram')}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-outline w-full mt-4"
      >
        ดูทั้งหมดใน Telegram
      </a>
    </div>
  )
}

function getFallbackSignals(): TelegramSignal[] {
  return [
    {
      id: 1,
      type: "WIN",
      level: 0,
      pair: "USDJPY",
      time: "10:30",
      text: "🟢TRADE WIN 0 Level - USDJPY Time: 10:30",
    },
    {
      id: 2,
      type: "LOSS",
      level: 2,
      pair: "EURUSD",
      time: "09:15",
      text: "🔴TRADE LOSS 2 Level - EURUSD Time: 09:15",
    },
    {
      id: 3,
      type: "WIN",
      level: 0,
      pair: "GBPUSD",
      time: "08:45",
      text: "🟢TRADE WIN 0 Level - GBPUSD Time: 08:45",
    },
  ]
}