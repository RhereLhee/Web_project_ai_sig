// components/FreeSignalRoom.tsx
// FREE PLAN signal room wrapper.
//
//  - Only visible 20:00–21:00 Asia/Bangkok (enforced server-side too)
//  - Only EURUSD + USDJPY are streamed through to SignalRoomContent
//  - Caps at 10 signals/day globally — live counter "X/10"
//  - PiP disabled, sound disabled
//  - Renders a countdown to the 21:00 close so users feel the pressure.
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { PipProvider } from "@/components/PipProvider"
import { SignalRoomContent } from "@/components/SignalRoomContent"
import { FREE_PAIR_SYMBOLS } from "@/lib/free-window"

type FreeStatus = {
  date: string
  inWindow: boolean
  closed: boolean
  count: number
  limit: number
  pairs: readonly string[]
  pairSymbols: readonly string[]
  windowStartHour: number
  windowEndHour: number
  secondsUntilEnd: number
  secondsUntilStart: number
}

const fakeUser = { signalSubscription: { endDate: new Date(Date.now() + 60 * 60 * 1000) } }

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function FreeSignalRoom() {
  const [status, setStatus] = useState<FreeStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const observedRef = useRef<Set<string>>(new Set())

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/signals/free-status', { cache: 'no-store' })
      if (!res.ok) return
      const data: FreeStatus = await res.json()
      setStatus(data)
    } catch {
      /* network hiccup — retry next tick */
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll every 5s for count / window changes. 5s is plenty — signals fire slower.
  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 5000)
    return () => clearInterval(id)
  }, [fetchStatus])

  // Local countdown ticker (1s) so the displayed seconds tick smoothly between
  // the 5s server polls.
  const [localTick, setLocalTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setLocalTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const displayedSecondsUntilEnd = status
    ? Math.max(0, status.secondsUntilEnd - localTick)
    : 0
  const displayedSecondsUntilStart = status
    ? Math.max(0, status.secondsUntilStart - localTick)
    : 0

  // When PipProvider reports a new signal, POST to /free-observe to increment.
  const handleNewSignal = useCallback(async (symbol: string, entryTime: string) => {
    const key = `${symbol}:${entryTime}`
    if (observedRef.current.has(key)) return
    observedRef.current.add(key)
    try {
      const res = await fetch('/api/signals/free-observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, entryTime }),
      })
      if (res.ok) {
        const data = await res.json()
        // Optimistically update the counter without waiting for the 5s poll.
        setStatus((prev) =>
          prev ? { ...prev, count: data.count ?? prev.count, closed: !!data.closed } : prev,
        )
      }
    } catch {
      // If the POST fails, let the 5s poll correct state.
    }
  }, [])

  // ------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------
  if (loading || !status) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-500 text-sm">กำลังโหลดข้อมูล FREE PLAN...</p>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Outside the free window → show countdown to next opening
  // ------------------------------------------------------------------
  if (!status.inWindow) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room — FREE</h1>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                เปิดให้ดูฟรีทุกวัน {String(status.windowStartHour).padStart(2, '0')}:00–{String(status.windowEndHour).padStart(2, '0')}:00
              </p>
            </div>
            <Link
              href="/signals?upgrade=1"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
            >
              ปลดล็อกทุกคู่
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-8 md:p-12 text-center text-white">
          <p className="text-sm text-gray-300 mb-2">เปิดอีกครั้งใน</p>
          <p className="text-5xl md:text-6xl font-mono font-bold tracking-widest">
            {formatCountdown(displayedSecondsUntilStart)}
          </p>
          <p className="text-sm text-gray-400 mt-4">
            ทุกวัน {String(status.windowStartHour).padStart(2, '0')}:00–{String(status.windowEndHour).padStart(2, '0')}:00 (เวลาไทย)
          </p>
          <p className="text-xs text-gray-500 mt-2">
            ดูได้เฉพาะ {status.pairs.join(' + ')} • จำกัดวันละ {status.limit} สัญญาณ
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <h2 className="font-semibold text-gray-900 mb-2">อยากดูตลอดเวลา?</h2>
          <p className="text-sm text-gray-500 mb-4">
            สมัครแพ็กเกจ Signal เพื่อดูทั้ง 6 คู่เงิน มีเสียงแจ้งเตือน และใช้ Picture-in-Picture ได้
          </p>
          <Link
            href="/signals?upgrade=1"
            className="inline-block px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium"
          >
            ดูแพ็กเกจ
          </Link>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Inside the window, but daily cap hit → show "ปิดจบวันนี้"
  // ------------------------------------------------------------------
  if (status.closed) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room — FREE</h1>
              </div>
              <p className="text-sm text-gray-500 mt-1">ครบโควตาวันนี้แล้ว</p>
            </div>
            <Link
              href="/signals?upgrade=1"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium"
            >
              ปลดล็อกแบบไม่จำกัด
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-8 md:p-12 text-center text-white">
          <p className="text-sm text-red-100 mb-3">วันนี้ครบ</p>
          <p className="text-5xl md:text-6xl font-bold">
            {status.count}/{status.limit}
          </p>
          <p className="text-sm text-red-100 mt-4">
            พรุ่งนี้ {String(status.windowStartHour).padStart(2, '0')}:00 เริ่มใหม่
          </p>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Active free session — live chart with gating
  // ------------------------------------------------------------------
  return (
    <PipProvider
      disableSound
      freePlanActive
      allowedPairs={FREE_PAIR_SYMBOLS}
      onNewSignal={handleNewSignal}
    >
      <div className="space-y-4">
        {/* Free Plan status bar */}
        <div className="bg-white rounded-xl shadow-sm p-3 md:p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 md:gap-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                FREE • LIVE
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">วันนี้</span>
                <span className="text-lg font-bold text-gray-900 tabular-nums">
                  {status.count}
                  <span className="text-gray-400">/{status.limit}</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">ปิดใน</span>
                <span className="text-lg font-mono font-bold text-gray-900 tabular-nums">
                  {formatCountdown(displayedSecondsUntilEnd)}
                </span>
              </div>
            </div>

            <Link
              href="/signals?upgrade=1"
              className="px-3 md:px-4 py-1.5 md:py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs md:text-sm font-medium"
            >
              ปลดล็อกทุกคู่ + เสียงแจ้งเตือน
            </Link>
          </div>

          <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
              style={{ width: `${Math.min(100, (status.count / status.limit) * 100)}%` }}
            />
          </div>
        </div>

        <SignalRoomContent user={fakeUser} />

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 md:p-4 text-xs md:text-sm text-gray-500">
          ใช้แผนฟรี: ดูได้เฉพาะ EURUSD + USDJPY · วันละ {status.limit} สัญญาณ · ไม่มีเสียงแจ้งเตือน · ไม่มี Picture-in-Picture
        </div>
      </div>
    </PipProvider>
  )
}
