// components/PipProvider.tsx
"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { signalService, type RealtimeData, type SymbolConfig } from '@/lib/signal-service'
import { pipManager } from '@/lib/pip-manager'

// ============================================
// TYPES
// ============================================

interface PipContextValue {
  // Connection
  connected: boolean
  dataMode: string

  // Data
  symbolData: Record<string, RealtimeData['symbols'][string]>
  symbolConfigs: Record<string, SymbolConfig>
  globalCountdown: number

  // PiP
  isPipActive: boolean
  isPipSupported: boolean
  togglePip: () => Promise<void>

  // Free-plan flags (propagated to SignalRoomContent)
  freePlanActive: boolean
  allowedPairs: readonly string[] | null // null = all pairs allowed
}

// ============================================
// CONTEXT
// ============================================

const PipContext = createContext<PipContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

interface PipProviderProps {
  children: ReactNode
  wsUrl?: string
  /** When true, skip playing the signal-alert sound (FREE PLAN). */
  disableSound?: boolean
  /** Mark the session as free — hides PiP button and filters pairs in SignalRoomContent. */
  freePlanActive?: boolean
  /**
   * When set, only these broker symbols will be reported to the UI; others are
   * filtered out before state update. Keep null for full access.
   */
  allowedPairs?: readonly string[] | null
  /** Called when a new (symbol, entryTime) pair is observed — used to POST /free-observe. */
  onNewSignal?: (symbol: string, entryTime: string) => void
}

export function PipProvider({
  children,
  wsUrl,
  disableSound = false,
  freePlanActive = false,
  allowedPairs = null,
  onNewSignal,
}: PipProviderProps) {
  // Connection state
  const [connected, setConnected] = useState(false)
  const [dataMode, setDataMode] = useState('offline')
  
  // Data state
  const [symbolData, setSymbolData] = useState<Record<string, RealtimeData['symbols'][string]>>({})
  const [symbolConfigs, setSymbolConfigs] = useState<Record<string, SymbolConfig>>({})
  const [globalCountdown, setGlobalCountdown] = useState(0)
  
  // PiP state
  const [isPipActive, setIsPipActive] = useState(false)
  const [isPipSupported, setIsPipSupported] = useState(false)

  // Sound Alert: track active signals เพื่อตรวจจับ signal ใหม่
  const prevSignalsRef = useRef<Record<string, string | null>>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sound Alert: สร้าง Audio element ครั้งเดียว
  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio('/signal_alert.wav')
      audioRef.current.volume = 0.7
    }
  }, [])

  // Sound Alert: เล่นเสียงเมื่อมี signal ใหม่
  const playSignalAlert = useCallback(() => {
    if (disableSound) return // FREE PLAN: silent by design
    try {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {
          // Browser อาจ block autoplay — ไม่ต้อง error
        })
      }
    } catch (e) {
      // Silent fail
    }
  }, [disableSound])

  // Sound Alert: ตรวจจับ signal ใหม่
  const checkForNewSignals = useCallback((newData: Record<string, any>) => {
    const prevSignals = prevSignalsRef.current

    for (const symbol in newData) {
      const activeSignal = newData[symbol]?.active_signal
      const entryTime = activeSignal?.entry_time || activeSignal?.trades?.[0]?.entry_time
      const currentSignalKey = activeSignal
        ? `${symbol}_${activeSignal.signal_type}_${entryTime}`
        : null

      const prevSignalKey = prevSignals[symbol] || null

      if (currentSignalKey && currentSignalKey !== prevSignalKey) {
        playSignalAlert()
        // FREE PLAN: also notify the wrapper so it can POST to /free-observe.
        if (onNewSignal && entryTime) {
          try { onNewSignal(symbol, String(entryTime)) } catch { /* swallow */ }
        }
      }

      prevSignals[symbol] = currentSignalKey
    }

    prevSignalsRef.current = prevSignals
  }, [playSignalAlert, onNewSignal])

  // Initialize services
  useEffect(() => {
    // Connect to signal service
    signalService.connect(wsUrl)

    // Subscribe to data updates
    const unsubscribeData = signalService.onData((data) => {
      if (data.symbols) {
        // FREE PLAN: filter to allowed pairs BEFORE touching state so the rest
        // of the UI never sees the gated symbols at all.
        const filtered: typeof data.symbols = allowedPairs
          ? Object.fromEntries(
              Object.entries(data.symbols).filter(([sym]) => allowedPairs.includes(sym)),
            )
          : data.symbols
        checkForNewSignals(filtered)
        setSymbolData(filtered)
      }
      if (data.countdown !== undefined) {
        setGlobalCountdown(data.stale ? 0 : data.countdown)
      }
      if (data.mode) {
        setDataMode(data.mode)
      }
    })

    // Subscribe to symbol config updates
    const unsubscribeSymbols = signalService.onSymbolConfigs((configs) => {
      setSymbolConfigs(configs)
    })

    // Subscribe to connection updates
    const unsubscribeConnection = signalService.onConnection((isConnected) => {
      setConnected(isConnected)
    })

    // Subscribe to PiP state updates
    const unsubscribePip = pipManager.onStateChange((active) => {
      setIsPipActive(active)
    })

    // Check PiP support — free plan forces this to false so the button is hidden.
    setIsPipSupported(!freePlanActive && pipManager.getIsSupported())

    // Cleanup
    return () => {
      unsubscribeData()
      unsubscribeSymbols()
      unsubscribeConnection()
      unsubscribePip()
    }
  }, [wsUrl, checkForNewSignals, allowedPairs, freePlanActive])

  // Countdown อิงจาก MT5 ตรงๆ — ไม่นับเอง
  // ค่า countdown มาจาก WebSocket data ทุก ~1 วินาที (signalService.onData)
  // เมื่อตลาดปิด MT5 หยุดส่ง countdown หยุดตาม

  // Toggle PiP — no-op under FREE PLAN.
  const togglePip = useCallback(async () => {
    if (freePlanActive) return
    await pipManager.toggle()
  }, [freePlanActive])

  const value: PipContextValue = {
    connected,
    dataMode,
    symbolData,
    symbolConfigs,
    globalCountdown,
    isPipActive,
    isPipSupported,
    togglePip,
    freePlanActive,
    allowedPairs: allowedPairs ?? null,
  }

  return (
    <PipContext.Provider value={value}>
      {children}
    </PipContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function usePip() {
  const context = useContext(PipContext)
  if (!context) {
    throw new Error('usePip must be used within a PipProvider')
  }
  return context
}

// ============================================
// OPTIONAL: Standalone hook for components outside provider
// ============================================

export function useSignalService() {
  const [connected, setConnected] = useState(false)
  const [data, setData] = useState<RealtimeData | null>(null)

  useEffect(() => {
    const unsubscribeConnection = signalService.onConnection(setConnected)
    const unsubscribeData = signalService.onData(setData)

    return () => {
      unsubscribeConnection()
      unsubscribeData()
    }
  }, [])

  return { connected, data }
}