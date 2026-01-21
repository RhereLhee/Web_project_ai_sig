// components/PipProvider.tsx
"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
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

  // Initialize services
  useEffect(() => {
    // Connect to signal service
    signalService.connect(wsUrl)

    // Subscribe to data updates
    const unsubscribeData = signalService.onData((data) => {
      if (data.symbols) {
        setSymbolData(data.symbols)
      }
      if (data.countdown !== undefined) {
        setGlobalCountdown(data.countdown)
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
  }, [wsUrl])

  // Local countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalCountdown(prev => prev > 0 ? prev - 1 : 299)
      
      // Also update countdown in symbolData
      setSymbolData(prev => {
        const updated = { ...prev }
        for (const symbol in updated) {
          if (updated[symbol]) {
            updated[symbol] = {
              ...updated[symbol],
              countdown: (updated[symbol].countdown || 0) > 0
                ? (updated[symbol].countdown || 0) - 1
                : 299
            }
          }
        }
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

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