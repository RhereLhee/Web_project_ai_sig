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
}

export function PipProvider({ children, wsUrl }: PipProviderProps) {
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
  }, [])

  // Sound Alert: ตรวจจับ signal ใหม่
  const checkForNewSignals = useCallback((newData: Record<string, any>) => {
    const prevSignals = prevSignalsRef.current

    for (const symbol in newData) {
      const activeSignal = newData[symbol]?.active_signal
      const currentSignalKey = activeSignal
        ? `${symbol}_${activeSignal.signal_type}_${activeSignal.entry_time || activeSignal.trades?.[0]?.entry_time}`
        : null

      const prevSignalKey = prevSignals[symbol] || null

      // ถ้ามี signal ใหม่ที่ไม่เคยเห็น เล่นเสียง
      if (currentSignalKey && currentSignalKey !== prevSignalKey) {
        playSignalAlert()
      }

      prevSignals[symbol] = currentSignalKey
    }

    prevSignalsRef.current = prevSignals
  }, [playSignalAlert])

  // Initialize services
  useEffect(() => {
    // Connect to signal service
    signalService.connect(wsUrl)

    // Subscribe to data updates
    const unsubscribeData = signalService.onData((data) => {
      if (data.symbols) {
        // Sound Alert: เช็ค signal ใหม่ก่อน update state
        checkForNewSignals(data.symbols)
        setSymbolData(data.symbols)
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

    // Check PiP support
    setIsPipSupported(pipManager.getIsSupported())

    // Cleanup
    return () => {
      unsubscribeData()
      unsubscribeSymbols()
      unsubscribeConnection()
      unsubscribePip()
    }
  }, [wsUrl, checkForNewSignals])

  // Countdown อิงจาก MT5 ตรงๆ — ไม่นับเอง
  // ค่า countdown มาจาก WebSocket data ทุก ~1 วินาที (signalService.onData)
  // เมื่อตลาดปิด MT5 หยุดส่ง countdown หยุดตาม

  // Toggle PiP
  const togglePip = useCallback(async () => {
    await pipManager.toggle()
  }, [])

  const value: PipContextValue = {
    connected,
    dataMode,
    symbolData,
    symbolConfigs,
    globalCountdown,
    isPipActive,
    isPipSupported,
    togglePip,
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