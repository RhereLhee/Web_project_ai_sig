// lib/pip-manager.ts
// Global PiP Manager - Canvas + Video + Render Loop
// ไม่ผูกกับ React lifecycle - ทำงานต่อเนื่องแม้ component unmount

import { signalService, type SignalData, type SymbolConfig, type RealtimeData } from './signal-service'

// ============================================
// CONFIGURATION
// ============================================

const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']
const DISPLAY_NAMES = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY']
const BARS_TO_SHOW = 10

// PiP Canvas size
const PIP_WIDTH = 640
const PIP_HEIGHT = 360

// PiP FPS - เพิ่มเป็น 30 เพื่อให้ smooth กว่า
const PIP_FPS = 30

const COLORS = {
  background: '#0a0a0a',
  up: '#00C853',
  down: '#F44336',
  callArrow: '#00E676',
  putArrow: '#FF1744',
  grid: '#1a1a1a',
  text: '#666666',
  axisText: '#888888',
  header: '#111111'
}

type PipStateListener = (active: boolean) => void

class PipManager {
  private static instance: PipManager | null = null

  // Canvas & Video
  private canvas: HTMLCanvasElement | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private ctx: CanvasRenderingContext2D | null = null

  // State
  private isActive = false
  private isSupported = false
  private renderLoopId: number | null = null
  private lastRenderTime = 0
  private frameInterval = 1000 / PIP_FPS

  // Data (cached from signal service)
  private symbolData: Record<string, SignalData> = {}
  private symbolConfigs: Record<string, SymbolConfig> = {}
  private globalCountdown = 0

  // Listeners
  private stateListeners: Set<PipStateListener> = new Set()

  // Unsubscribe functions
  private unsubscribeData: (() => void) | null = null
  private unsubscribeSymbols: (() => void) | null = null

  private constructor() {
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  static getInstance(): PipManager {
    if (!PipManager.instance) {
      PipManager.instance = new PipManager()
    }
    return PipManager.instance
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  private init(): void {
    // Check PiP support
    this.isSupported = 'pictureInPictureEnabled' in document && 
                       (document as any).pictureInPictureEnabled

    // Cleanup any existing PiP elements (from hot reload or previous instances)
    const existingVideos = document.querySelectorAll('video[data-pip-manager]')
    const existingCanvases = document.querySelectorAll('canvas[data-pip-manager]')
    existingVideos.forEach(v => v.remove())
    existingCanvases.forEach(c => c.remove())

    // Create hidden canvas
    this.canvas = document.createElement('canvas')
    this.canvas.width = PIP_WIDTH
    this.canvas.height = PIP_HEIGHT
    this.canvas.style.display = 'none'
    this.canvas.setAttribute('data-pip-manager', 'true')
    document.body.appendChild(this.canvas)
    
    // Use optimized context for animations
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
      willReadFrequently: false
    })

    // Create hidden video
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.video.autoplay = true
    this.video.controls = false
    this.video.disablePictureInPicture = false
    this.video.style.display = 'none'
    this.video.style.backgroundColor = 'transparent'
    this.video.style.opacity = '1'
    this.video.setAttribute('playsinline', '')
    this.video.setAttribute('webkit-playsinline', '')
    this.video.setAttribute('data-pip-manager', 'true')
    document.body.appendChild(this.video)

    // Setup video events
    this.video.addEventListener('enterpictureinpicture', () => {
      this.isActive = true
      this.notifyStateListeners(true)
    })

    this.video.addEventListener('leavepictureinpicture', () => {
      this.isActive = false
      this.stopRenderLoop()
      this.cleanupStream()
      this.notifyStateListeners(false)
    })

    // Subscribe to signal service
    this.subscribeToSignalService()
  }

  private subscribeToSignalService(): void {
    // Subscribe to data updates
    this.unsubscribeData = signalService.onData((data: RealtimeData) => {
      if (data.symbols) {
        this.symbolData = data.symbols
      }
      if (data.countdown !== undefined) {
        this.globalCountdown = data.countdown
      }
    })

    // Subscribe to symbol config updates
    this.unsubscribeSymbols = signalService.onSymbolConfigs((configs) => {
      this.symbolConfigs = configs
    })
  }

  // ============================================
  // PIP CONTROL
  // ============================================

  async toggle(): Promise<void> {
    if (!this.isSupported) {
      console.warn('PiP not supported')
      return
    }

    if (this.isActive) {
      await this.stop()
    } else {
      await this.start()
    }
  }

  async start(): Promise<void> {
    if (!this.video || !this.canvas || !this.isSupported) {
      return
    }
    if (this.isActive) {
      return
    }

    try {
      // Draw initial frame
      this.drawPipCanvas()

      // Create stream from canvas
      this.stream = (this.canvas as any).captureStream(PIP_FPS)
      
      // Add silent audio track to make Chrome treat it as a real video
      try {
        const audioCtx = new AudioContext()
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        gainNode.gain.value = 0 // Silent
        oscillator.connect(gainNode)
        const dest = audioCtx.createMediaStreamDestination()
        gainNode.connect(dest)
        oscillator.start()
        
        const audioTrack = dest.stream.getAudioTracks()[0]
        if (audioTrack && this.stream) {
          this.stream.addTrack(audioTrack)
        }
      } catch (e) {
        // Could not add audio track - continue anyway
      }
      
      this.video.srcObject = this.stream

      // Start video playback
      await this.video.play()

      // Request PiP
      await (this.video as any).requestPictureInPicture()

      // Start render loop
      this.startRenderLoop()

    } catch (error) {
      console.error('Failed to start PiP:', error)
      this.isActive = false
      this.cleanupStream()
    }
  }

  async stop(): Promise<void> {
    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture()
      }
    } catch (error) {
      console.error('Failed to stop PiP:', error)
    }
  }

  // ============================================
  // RENDER LOOP
  // ============================================

  private startRenderLoop(): void {
    if (this.renderLoopId !== null) return

    const render = (timestamp: number) => {
      if (!this.isActive) {
        this.renderLoopId = null
        return
      }

      const elapsed = timestamp - this.lastRenderTime
      if (elapsed >= this.frameInterval) {
        this.lastRenderTime = timestamp - (elapsed % this.frameInterval)
        this.drawPipCanvas()
      }

      this.renderLoopId = requestAnimationFrame(render)
    }

    this.renderLoopId = requestAnimationFrame(render)
  }

  private stopRenderLoop(): void {
    if (this.renderLoopId !== null) {
      cancelAnimationFrame(this.renderLoopId)
      this.renderLoopId = null
    }
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    if (this.video) {
      this.video.srcObject = null
    }
  }

  // ============================================
  // CANVAS RENDERING
  // ============================================

  private drawPipCanvas(): void {
    if (!this.ctx || !this.canvas) return

    const ctx = this.ctx
    const width = this.canvas.width
    const height = this.canvas.height

    // Clear canvas
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // Draw header
    this.drawHeader(ctx, width)

    // Draw 4 charts in 2x2 grid
    const chartWidth = width / 2
    const chartHeight = (height - 40) / 2
    const headerHeight = 40

    SYMBOLS.forEach((symbol, index) => {
      const col = index % 2
      const row = Math.floor(index / 2)
      const x = col * chartWidth
      const y = headerHeight + row * chartHeight

      this.drawChart(ctx, symbol, x, y, chartWidth, chartHeight, index)
    })
  }

  private drawHeader(ctx: CanvasRenderingContext2D, width: number): void {
    // Header background
    ctx.fillStyle = COLORS.header
    ctx.fillRect(0, 0, width, 40)

    // Title
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('📊 TechTrade Signal', 10, 26)

    // Countdown
    ctx.textAlign = 'right'
    ctx.font = 'bold 20px monospace'
    ctx.fillStyle = this.globalCountdown <= 10 ? COLORS.down : '#FFFFFF'
    ctx.fillText(`${this.globalCountdown}s`, width - 10, 28)
  }

  private drawChart(
    ctx: CanvasRenderingContext2D,
    symbol: string,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
    index: number
  ): void {
    const data = this.symbolData[symbol]
    const config = this.symbolConfigs[symbol]
    const displayName = DISPLAY_NAMES[index]

    // Symbol header
    ctx.fillStyle = COLORS.header
    ctx.fillRect(offsetX, offsetY, width, 20)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(displayName, offsetX + 5, offsetY + 14)

    // Status indicator
    if (config?.enabled === false) {
      ctx.fillStyle = COLORS.down
      ctx.fillText('⏸', offsetX + width - 20, offsetY + 14)
    }

    // Active signal indicator
    if (data?.active_signal) {
      const isCall = data.active_signal.signal === 1 || data.active_signal.signal_type === 'CALL'
      ctx.fillStyle = isCall ? COLORS.callArrow : COLORS.putArrow
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(isCall ? '▲' : '▼', offsetX + width - 35, offsetY + 14)
    }

    // Adjust for header
    offsetY += 20
    height -= 20

    if (!data || !data.candles || data.candles.length === 0) {
      ctx.fillStyle = COLORS.text
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Loading...', offsetX + width / 2, offsetY + height / 2)
      return
    }

    // Background
    ctx.fillStyle = COLORS.background
    ctx.fillRect(offsetX, offsetY, width, height)

    const candles = data.candles.slice(-BARS_TO_SHOW)
    if (candles.length === 0) return

    // Calculate price range
    let minPrice = Math.min(...candles.map(c => c.low))
    let maxPrice = Math.max(...candles.map(c => c.high))
    const priceRange = maxPrice - minPrice
    const pricePadding = priceRange * 0.18
    minPrice -= pricePadding
    maxPrice += pricePadding

    const margin = { top: 5, bottom: 5, left: 5, right: 50 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const barTotalWidth = (chartWidth * 0.75) / BARS_TO_SHOW
    const barBodyWidth = barTotalWidth * 0.7
    const startOffset = chartWidth * 0.08

    const priceToY = (price: number) => {
      const ratio = (price - minPrice) / (maxPrice - minPrice)
      return offsetY + margin.top + chartHeight * (1 - ratio)
    }

    const indexToX = (i: number) => {
      return offsetX + margin.left + startOffset + (i + 0.5) * barTotalWidth
    }

    // Y-axis labels
    const decimals = symbol.includes('JPY') ? 3 : 5
    ctx.fillStyle = COLORS.axisText
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'

    for (let i = 0; i <= 4; i++) {
      const price = minPrice + (maxPrice - minPrice) * (i / 4)
      const y = priceToY(price)
      ctx.fillText(price.toFixed(decimals), offsetX + width - margin.right + 3, y + 3)

      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(offsetX + margin.left, y)
      ctx.lineTo(offsetX + width - margin.right, y)
      ctx.stroke()
    }

    // Draw candles
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const x = indexToX(i)
      const isUp = c.close >= c.open
      const color = isUp ? COLORS.up : COLORS.down

      // Wick
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, priceToY(c.high))
      ctx.lineTo(x, priceToY(c.low))
      ctx.stroke()

      // Body
      const bodyTop = Math.min(priceToY(c.open), priceToY(c.close))
      const bodyBottom = Math.max(priceToY(c.open), priceToY(c.close))
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

      ctx.fillStyle = color
      ctx.fillRect(x - barBodyWidth / 2, bodyTop, barBodyWidth, bodyHeight)
    }

    // Current price line
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1]
      const currentY = priceToY(lastCandle.close)

      ctx.strokeStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
      ctx.lineWidth = 1
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(offsetX + margin.left, currentY)
      ctx.lineTo(offsetX + width - margin.right, currentY)
      ctx.stroke()
      ctx.setLineDash([])

      // Price label
      ctx.fillStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
      ctx.font = 'bold 9px monospace'
      ctx.fillText(`►${lastCandle.close.toFixed(decimals)}`, offsetX + width - margin.right + 2, currentY - 5)
    }

    // Draw signals
    this.drawSignals(ctx, data, candles, indexToX, priceToY)
  }

  private drawSignals(
    ctx: CanvasRenderingContext2D,
    data: SignalData,
    candles: SignalData['candles'],
    indexToX: (i: number) => number,
    priceToY: (price: number) => number
  ): void {
    const arrowSize = 10

    // Active signals
    const activeSignal = data.active_signal
    if (activeSignal?.trades) {
      activeSignal.trades.forEach((trade) => {
        const tradeIndex = candles.findIndex(c => c.time === trade.entry_time)
        if (tradeIndex === -1) return

        const tradeCandle = candles[tradeIndex]
        const x = indexToX(tradeIndex)
        const isCall = activeSignal.signal === 1 || activeSignal.signal_type === 'CALL'
        const y = isCall
          ? priceToY(tradeCandle.low) + arrowSize * 2 + 3
          : priceToY(tradeCandle.high) - arrowSize * 2 - 3

        this.drawArrow(ctx, x, y, isCall, isCall ? COLORS.callArrow : COLORS.putArrow, arrowSize)
      })
    }

    // Completed sequences
    const completed = data.completed_sequences || []
    completed.forEach((seq: any) => {
      if (!seq.trades) return
      seq.trades.forEach((trade: any) => {
        const tradeIndex = candles.findIndex(c => c.time === trade.entry_time)
        if (tradeIndex === -1) return

        const tradeCandle = candles[tradeIndex]
        const x = indexToX(tradeIndex)
        const isCall = seq.signal === 1 || seq.signal_type === 'CALL'
        const y = isCall
          ? priceToY(tradeCandle.low) + arrowSize * 2 + 3
          : priceToY(tradeCandle.high) - arrowSize * 2 - 3

        this.drawArrow(ctx, x, y, isCall, isCall ? COLORS.callArrow : COLORS.putArrow, arrowSize - 2)
      })
    })
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isCall: boolean,
    color: string,
    size: number
  ): void {
    const headSize = size * 0.7
    const tailLength = size * 1.2
    const tailWidth = size * 0.25

    ctx.fillStyle = color
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1.5

    ctx.beginPath()

    if (isCall) {
      ctx.moveTo(x, y - tailLength - headSize)
      ctx.lineTo(x - headSize, y - tailLength)
      ctx.lineTo(x - tailWidth, y - tailLength)
      ctx.lineTo(x - tailWidth, y)
      ctx.lineTo(x + tailWidth, y)
      ctx.lineTo(x + tailWidth, y - tailLength)
      ctx.lineTo(x + headSize, y - tailLength)
      ctx.lineTo(x, y - tailLength - headSize)
    } else {
      ctx.moveTo(x, y + tailLength + headSize)
      ctx.lineTo(x - headSize, y + tailLength)
      ctx.lineTo(x - tailWidth, y + tailLength)
      ctx.lineTo(x - tailWidth, y)
      ctx.lineTo(x + tailWidth, y)
      ctx.lineTo(x + tailWidth, y + tailLength)
      ctx.lineTo(x + headSize, y + tailLength)
      ctx.lineTo(x, y + tailLength + headSize)
    }

    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // ============================================
  // LISTENERS
  // ============================================

  onStateChange(listener: PipStateListener): () => void {
    this.stateListeners.add(listener)
    listener(this.isActive)

    return () => {
      this.stateListeners.delete(listener)
    }
  }

  private notifyStateListeners(active: boolean): void {
    this.stateListeners.forEach(listener => {
      try {
        listener(active)
      } catch (e) {
        console.error('State listener error:', e)
      }
    })
  }

  // ============================================
  // GETTERS
  // ============================================

  getIsActive(): boolean {
    return this.isActive
  }

  getIsSupported(): boolean {
    return this.isSupported
  }

  // ============================================
  // CLEANUP
  // ============================================

  destroy(): void {
    this.stop()

    if (this.unsubscribeData) {
      this.unsubscribeData()
    }
    if (this.unsubscribeSymbols) {
      this.unsubscribeSymbols()
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    if (this.video && this.video.parentNode) {
      this.video.parentNode.removeChild(this.video)
    }

    this.canvas = null
    this.video = null
    this.ctx = null
  }
}

// Export singleton instance
export const pipManager = PipManager.getInstance()