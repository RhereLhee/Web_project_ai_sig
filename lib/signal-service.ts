// lib/signal-service.ts
// Global Signal Service - WebSocket connection + data store
// ไม่ผูกกับ React lifecycle - ทำงานต่อเนื่องแม้ component unmount

type SignalData = {
  candles: Array<{
    time: string
    open: number
    high: number
    low: number
    close: number
  }>
  countdown?: number
  active_signal?: {
    signal?: number
    signal_type?: string
    entry_price?: number
    trades?: Array<{
      entry_time: string
      is_realtime?: boolean
      win?: boolean
    }>
  }
  completed_sequences?: any[]
}

type SymbolConfig = {
  symbol: string
  enabled: boolean
  threshold: number
  notes?: string | null
}

type RealtimeData = {
  timestamp: string
  countdown: number
  mode: string
  symbols: Record<string, SignalData>
  type?: string
  connections?: number
}

type Listener = (data: RealtimeData) => void
type SymbolListener = (configs: Record<string, SymbolConfig>) => void
type ConnectionListener = (connected: boolean) => void

class SignalService {
  private static instance: SignalService | null = null
  
  private ws: WebSocket | null = null
  private wsUrl: string = ''
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  
  // Data store
  private data: RealtimeData | null = null
  private symbolConfigs: Record<string, SymbolConfig> = {}
  private connected = false
  
  // Listeners
  private dataListeners: Set<Listener> = new Set()
  private symbolListeners: Set<SymbolListener> = new Set()
  private connectionListeners: Set<ConnectionListener> = new Set()
  
  // Fallback polling (if WebSocket fails)
  private pollingInterval: ReturnType<typeof setInterval> | null = null
  private usePolling = false

  private constructor() {}

  static getInstance(): SignalService {
    if (!SignalService.instance) {
      SignalService.instance = new SignalService()
    }
    return SignalService.instance
  }

  // ============================================
  // CONNECTION
  // ============================================

  connect(wsUrl?: string, httpUrl?: string): void {
    // Default URLs - ชี้ไปที่ Render API
    const defaultWsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://trading-api-83hs.onrender.com/ws/signal'
    
    this.wsUrl = wsUrl || defaultWsUrl
    
    // Try WebSocket first
    this.connectWebSocket()
  }

  private connectWebSocket(): void {
    if (typeof window === 'undefined') return
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      console.log(`🔌 Connecting to WebSocket: ${this.wsUrl}`)
      this.ws = new WebSocket(this.wsUrl)

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected')
        this.connected = true
        this.reconnectAttempts = 0
        this.usePolling = false
        this.stopPolling()
        this.notifyConnectionListeners(true)
        
        // Request symbol configs - ต้องรอ connection เปิดแล้ว
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send('get_symbols')
          }
        }, 100)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.handleMessage(data)
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e)
        }
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
      }

      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected')
        this.connected = false
        this.notifyConnectionListeners(false)
        this.scheduleReconnect()
      }

    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      this.startPollingFallback()
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'initial':
      case 'realtime_update':
        this.data = data as RealtimeData
        this.notifyDataListeners(this.data)
        break
        
      case 'symbols':
        if (data.symbols) {
          this.symbolConfigs = {}
          data.symbols.forEach((s: SymbolConfig) => {
            this.symbolConfigs[s.symbol] = s
          })
          this.notifySymbolListeners(this.symbolConfigs)
        }
        break
        
      case 'symbol_update':
        if (data.symbol && data.data) {
          this.symbolConfigs[data.symbol] = data.data
          this.notifySymbolListeners(this.symbolConfigs)
        }
        break
        
      case 'pong':
        // Heartbeat response
        break
        
      default:
        // Unknown message type, might be realtime data
        if (data.symbols && data.timestamp) {
          this.data = data as RealtimeData
          this.notifyDataListeners(this.data)
        }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('⚠️ Max reconnect attempts reached, falling back to polling')
      this.startPollingFallback()
      return
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++
    
    console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connectWebSocket()
    }, delay)
  }

  // ============================================
  // POLLING FALLBACK
  // ============================================

  private startPollingFallback(): void {
    if (this.pollingInterval) return
    
    this.usePolling = true
    console.log('📡 Starting HTTP polling fallback')
    
    // Initial fetch
    this.fetchData()
    
    // Poll every second
    this.pollingInterval = setInterval(() => {
      this.fetchData()
    }, 1000)
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval)
      this.pollingInterval = null
    }
  }

  private async fetchData(): Promise<void> {
    try {
      const res = await fetch('/api/trading/realtime')
      if (res.ok) {
        const data = await res.json()
        this.data = data as RealtimeData
        this.connected = true
        this.notifyConnectionListeners(true)
        this.notifyDataListeners(this.data)
      }
    } catch (error) {
      console.error('Polling failed:', error)
      this.connected = false
      this.notifyConnectionListeners(false)
    }
  }

  // ============================================
  // DISCONNECT
  // ============================================

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    this.stopPolling()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.connected = false
  }

  // ============================================
  // LISTENERS
  // ============================================

  onData(listener: Listener): () => void {
    this.dataListeners.add(listener)
    
    // Send current data immediately if available
    if (this.data) {
      listener(this.data)
    }
    
    return () => {
      this.dataListeners.delete(listener)
    }
  }

  onSymbolConfigs(listener: SymbolListener): () => void {
    this.symbolListeners.add(listener)
    
    // Send current configs immediately if available
    if (Object.keys(this.symbolConfigs).length > 0) {
      listener(this.symbolConfigs)
    }
    
    return () => {
      this.symbolListeners.delete(listener)
    }
  }

  onConnection(listener: ConnectionListener): () => void {
    this.connectionListeners.add(listener)
    listener(this.connected)
    
    return () => {
      this.connectionListeners.delete(listener)
    }
  }

  private notifyDataListeners(data: RealtimeData): void {
    this.dataListeners.forEach(listener => {
      try {
        listener(data)
      } catch (e) {
        console.error('Data listener error:', e)
      }
    })
  }

  private notifySymbolListeners(configs: Record<string, SymbolConfig>): void {
    this.symbolListeners.forEach(listener => {
      try {
        listener(configs)
      } catch (e) {
        console.error('Symbol listener error:', e)
      }
    })
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected)
      } catch (e) {
        console.error('Connection listener error:', e)
      }
    })
  }

  // ============================================
  // GETTERS
  // ============================================

  getData(): RealtimeData | null {
    return this.data
  }

  getSymbolConfigs(): Record<string, SymbolConfig> {
    return this.symbolConfigs
  }

  isConnected(): boolean {
    return this.connected
  }

  isUsingPolling(): boolean {
    return this.usePolling
  }

  getConnectionCount(): number {
    return this.data?.connections || 0
  }
}

// Export singleton instance
export const signalService = SignalService.getInstance()

// Export types
export type { SignalData, SymbolConfig, RealtimeData }