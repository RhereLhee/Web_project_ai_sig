// components/SignalRoomContent.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ============================================
// CONFIGURATION
// ============================================
const UPDATE_INTERVAL = 1000
const BARS_TO_SHOW = 10

const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']
const DISPLAY_NAMES = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY']

const COLORS = {
  background: '#0a0a0a',
  up: '#00C853',
  down: '#F44336',
  callArrow: '#00E676',
  putArrow: '#FF1744',
  grid: '#1a1a1a',
  text: '#666666',
  axisText: '#888888'
}

// PiP Canvas size - Full HD
const PIP_WIDTH = 1920
const PIP_HEIGHT = 1080

interface SignalData {
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

interface SymbolConfig {
  symbol: string
  enabled: boolean
  threshold: number
}

interface User {
  signalSubscription?: {
    endDate: Date
  }
}

interface SignalRoomContentProps {
  user: User
}

export function SignalRoomContent({ user }: SignalRoomContentProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null])
  const containerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null])
  
  // PiP refs
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const pipVideoRef = useRef<HTMLVideoElement | null>(null)
  
  const [symbolData, setSymbolData] = useState<Record<string, SignalData>>({})
  const [symbolConfigs, setSymbolConfigs] = useState<Record<string, SymbolConfig>>({})
  const [globalCountdown, setGlobalCountdown] = useState(0)
  const [connected, setConnected] = useState(false)
  const [dataMode, setDataMode] = useState('mock')
  const [isPipActive, setIsPipActive] = useState(false)
  const [pipSupported, setPipSupported] = useState(false)

  // Check PiP support
  useEffect(() => {
    setPipSupported('pictureInPictureEnabled' in document && (document as any).pictureInPictureEnabled)
  }, [])

  // Load symbol configs (enabled/disabled status)
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        const res = await fetch('/api/trading/symbols')
        if (res.ok) {
          const data = await res.json()
          const configs: Record<string, SymbolConfig> = {}
          data.symbols?.forEach((s: SymbolConfig) => {
            configs[s.symbol] = s
          })
          setSymbolConfigs(configs)
        }
      } catch (error) {
        console.error('Failed to load symbol configs')
      }
    }

    loadConfigs()
    const interval = setInterval(loadConfigs, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/trading/realtime')
        if (!res.ok) throw new Error('Failed')
        
        const data = await res.json()
        setConnected(true)
        setDataMode(data.mode || 'mock')
        
        if (data.countdown !== undefined) {
          setGlobalCountdown(data.countdown)
        }
        
        if (data.symbols) {
          const newData: Record<string, SignalData> = {}
          for (const symbol of SYMBOLS) {
            if (data.symbols[symbol]) {
              newData[symbol] = {
                ...data.symbols[symbol],
                countdown: data.symbols[symbol].countdown ?? data.countdown
              }
            }
          }
          setSymbolData(newData)
        }
      } catch {
        setConnected(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, UPDATE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Local countdown timer
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setGlobalCountdown(prev => prev > 0 ? prev - 1 : 299)
      setSymbolData(prev => {
        const updated = { ...prev }
        for (const symbol of SYMBOLS) {
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

    return () => clearInterval(countdownInterval)
  }, [])

  // Check if symbol is enabled
  const isSymbolEnabled = (symbol: string) => {
    return symbolConfigs[symbol]?.enabled ?? true
  }

  // Draw arrow with tail (ลูกศรหางยาว)
  const drawArrowWithTail = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isCall: boolean,
    color: string,
    size: number,
    isForPip: boolean
  ) => {
    const headSize = size * 0.7
    const tailLength = size * 1.2
    const tailWidth = size * 0.25

    ctx.fillStyle = color
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = isForPip ? 2 : 1.5

    ctx.beginPath()
    
    if (isCall) {
      // Arrow pointing UP
      // Arrow head
      ctx.moveTo(x, y - tailLength - headSize) // tip
      ctx.lineTo(x - headSize, y - tailLength) // left corner
      ctx.lineTo(x - tailWidth, y - tailLength) // left neck
      // Tail
      ctx.lineTo(x - tailWidth, y) // left bottom
      ctx.lineTo(x + tailWidth, y) // right bottom
      ctx.lineTo(x + tailWidth, y - tailLength) // right neck
      // Back to head
      ctx.lineTo(x + headSize, y - tailLength) // right corner
      ctx.lineTo(x, y - tailLength - headSize) // back to tip
    } else {
      // Arrow pointing DOWN
      // Arrow head
      ctx.moveTo(x, y + tailLength + headSize) // tip
      ctx.lineTo(x - headSize, y + tailLength) // left corner
      ctx.lineTo(x - tailWidth, y + tailLength) // left neck
      // Tail
      ctx.lineTo(x - tailWidth, y) // left top
      ctx.lineTo(x + tailWidth, y) // right top
      ctx.lineTo(x + tailWidth, y + tailLength) // right neck
      // Back to head
      ctx.lineTo(x + headSize, y + tailLength) // right corner
      ctx.lineTo(x, y + tailLength + headSize) // back to tip
    }
    
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Draw main chart
  const drawChart = useCallback((index: number, data: SignalData) => {
    const canvas = canvasRefs.current[index]
    const container = containerRefs.current[index]
    if (!canvas || !container || !data.candles || data.candles.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = container.getBoundingClientRect()
    const width = rect.width
    const height = rect.height
    if (width === 0 || height === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    drawChartContent(ctx, data, SYMBOLS[index], width, height, false)
  }, [])

  // Draw chart content
  const drawChartContent = (
    ctx: CanvasRenderingContext2D,
    data: SignalData,
    symbol: string,
    width: number,
    height: number,
    isForPip: boolean
  ) => {
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    const candles = data.candles.slice(-BARS_TO_SHOW)
    if (candles.length === 0) return

    let minPrice = Math.min(...candles.map(c => c.low))
    let maxPrice = Math.max(...candles.map(c => c.high))
    
    const priceRange = maxPrice - minPrice
    const pricePadding = priceRange * 0.18
    minPrice -= pricePadding
    maxPrice += pricePadding

    const margin = isForPip 
      ? { top: 50, bottom: 15, left: 15, right: 90 }
      : { top: 30, bottom: 10, left: 50, right: 55 }
    
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const totalBarSpace = chartWidth * 0.75
    const barTotalWidth = totalBarSpace / BARS_TO_SHOW
    const barBodyWidth = barTotalWidth * 0.7
    const startOffset = chartWidth * 0.08

    const priceToY = (price: number) => {
      const ratio = (price - minPrice) / (maxPrice - minPrice)
      return margin.top + chartHeight * (1 - ratio)
    }

    const indexToX = (i: number) => {
      return margin.left + startOffset + (i + 0.5) * barTotalWidth
    }

    // Y-axis labels
    ctx.fillStyle = COLORS.axisText
    ctx.font = isForPip ? '16px monospace' : '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    
    const decimals = symbol.includes('JPY') ? 3 : 5

    for (let i = 0; i <= 6; i++) {
      const price = minPrice + (maxPrice - minPrice) * (i / 6)
      const y = priceToY(price)
      ctx.fillText(price.toFixed(decimals), width - margin.right + 8, y)
      
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = isForPip ? 1 : 0.5
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(width - margin.right, y)
      ctx.stroke()
    }

    // Draw candles
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const x = indexToX(i)
      const isUp = c.close >= c.open
      const color = isUp ? COLORS.up : COLORS.down

      ctx.strokeStyle = color
      ctx.lineWidth = isForPip ? 2 : 1
      ctx.beginPath()
      ctx.moveTo(x, priceToY(c.high))
      ctx.lineTo(x, priceToY(c.low))
      ctx.stroke()

      const bodyTop = Math.min(priceToY(c.open), priceToY(c.close))
      const bodyBottom = Math.max(priceToY(c.open), priceToY(c.close))
      const bodyHeight = Math.max(bodyBottom - bodyTop, 1)

      ctx.fillStyle = color
      ctx.fillRect(x - barBodyWidth / 2, bodyTop, barBodyWidth, bodyHeight)
    }

    // Draw current price line
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1]
      const currentY = priceToY(lastCandle.close)

      ctx.strokeStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(margin.left, currentY)
      ctx.lineTo(width - margin.right, currentY)
      ctx.stroke()
      ctx.setLineDash([])

      // Price label
      ctx.fillStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
      ctx.font = isForPip ? 'bold 14px monospace' : 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`► ${lastCandle.close.toFixed(decimals)}`, width - margin.right + 5, currentY - 10)
    }

    // Draw signals - ลูกศรหางยาว, ไม่มีสีเทา
    const activeSignal = data.active_signal
    if (activeSignal && activeSignal.trades && activeSignal.trades.length > 0) {
      const arrowSize = isForPip ? 20 : 14

      activeSignal.trades.forEach((trade) => {
        const tradeCandle = candles.find(c => c.time === trade.entry_time)
        if (!tradeCandle) return

        const tradeIndex = candles.findIndex(c => c.time === trade.entry_time)
        if (tradeIndex === -1) return

        const x = indexToX(tradeIndex)
        const isCall = activeSignal.signal === 1 || activeSignal.signal_type === 'CALL'
        const y = isCall 
          ? priceToY(tradeCandle.low) + arrowSize * 2 + 5 
          : priceToY(tradeCandle.high) - arrowSize * 2 - 5

        // ✅ ไม่มีสีเทา - ใช้สีตามทิศทางเสมอ
        const arrowColor = isCall ? COLORS.callArrow : COLORS.putArrow

        drawArrowWithTail(ctx, x, y, isCall, arrowColor, arrowSize, isForPip)
      })
    }

    // Draw completed sequences - ลูกศรหางยาว, ไม่มีสีเทา
    const completed = data.completed_sequences || []
    completed.forEach((seq: any) => {
      if (!seq.trades) return
      seq.trades.forEach((trade: any) => {
        const tradeCandle = candles.find((c: any) => c.time === trade.entry_time)
        if (!tradeCandle) return

        const candleIndex = candles.findIndex((c: any) => c.time === trade.entry_time)
        if (candleIndex === -1) return

        const x = indexToX(candleIndex)
        const isCall = seq.signal === 1 || seq.signal_type === 'CALL'
        const arrowSize = isForPip ? 16 : 12
        const y = isCall 
          ? priceToY(tradeCandle.low) + arrowSize * 2 + 5 
          : priceToY(tradeCandle.high) - arrowSize * 2 - 5

        // ✅ ไม่มีสีเทา - ใช้สีตามทิศทางเสมอ
        const arrowColor = isCall ? COLORS.callArrow : COLORS.putArrow

        drawArrowWithTail(ctx, x, y, isCall, arrowColor, arrowSize, isForPip)
      })
    })
  }

  // Draw PiP canvas
  const drawPipCanvas = useCallback(() => {
    const canvas = pipCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = PIP_WIDTH
    canvas.height = PIP_HEIGHT

    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, PIP_WIDTH, PIP_HEIGHT)

    const cellWidth = PIP_WIDTH / 2
    const cellHeight = PIP_HEIGHT / 2

    SYMBOLS.forEach((symbol, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const offsetX = col * cellWidth
      const offsetY = row * cellHeight

      // Check if disabled - draw maintenance overlay
      if (!isSymbolEnabled(symbol)) {
        ctx.fillStyle = '#000000'
        ctx.fillRect(offsetX, offsetY, cellWidth, cellHeight)
        
        ctx.strokeStyle = '#333'
        ctx.lineWidth = 2
        ctx.strokeRect(offsetX + 1, offsetY + 1, cellWidth - 2, cellHeight - 2)
        
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 28px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('ปิดปรับปรุงชั่วคราว', offsetX + cellWidth / 2, offsetY + cellHeight / 2 - 10)
        
        ctx.font = '18px sans-serif'
        ctx.fillStyle = '#666666'
        ctx.fillText('ขออภัยในความไม่สะดวก', offsetX + cellWidth / 2, offsetY + cellHeight / 2 + 25)
        ctx.textAlign = 'left'
        return
      }

      const data = symbolData[symbol]
      if (!data || !data.candles || data.candles.length === 0) return

      // Border
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.strokeRect(offsetX + 1, offsetY + 1, cellWidth - 2, cellHeight - 2)

      // Header
      ctx.fillStyle = COLORS.callArrow
      ctx.font = 'bold 28px monospace'
      ctx.fillText(DISPLAY_NAMES[i], offsetX + 15, offsetY + 35)

      // Countdown
      const cd = data.countdown || globalCountdown
      const mins = Math.floor(cd / 60)
      const secs = cd % 60
      const countdownText = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 28px monospace'
      ctx.fillText(countdownText, offsetX + cellWidth - 100, offsetY + 35)

      // Chart area
      const chartY = offsetY + 50
      const chartHeight = cellHeight - 55

      ctx.save()
      ctx.beginPath()
      ctx.rect(offsetX + 5, chartY, cellWidth - 10, chartHeight)
      ctx.clip()

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = cellWidth - 10
      tempCanvas.height = chartHeight
      const tempCtx = tempCanvas.getContext('2d')
      if (tempCtx) {
        drawChartContent(tempCtx, data, symbol, cellWidth - 10, chartHeight, true)
        ctx.drawImage(tempCanvas, offsetX + 5, chartY)
      }
      ctx.restore()
    })

  }, [symbolData, globalCountdown, symbolConfigs])

  // Toggle PiP
  const togglePip = async () => {
    const video = pipVideoRef.current
    const canvas = pipCanvasRef.current

    if (!video || !canvas) return

    try {
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture()
        setIsPipActive(false)
      } else {
        const stream = (canvas as any).captureStream(30)
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        ;(video as any).disableRemotePlayback = true
        video.controls = false

        await video.play()
        await (video as any).requestPictureInPicture()
        setIsPipActive(true)
      }
    } catch (err) {
      console.error('PiP error:', err)
    }
  }

  // PiP events
  useEffect(() => {
    const video = pipVideoRef.current
    if (!video) return

    const handleEnter = () => setIsPipActive(true)
    const handleLeave = () => setIsPipActive(false)

    video.addEventListener('enterpictureinpicture', handleEnter)
    video.addEventListener('leavepictureinpicture', handleLeave)

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnter)
      video.removeEventListener('leavepictureinpicture', handleLeave)
    }
  }, [])

  // Draw all charts
  useEffect(() => {
    const draw = () => {
      SYMBOLS.forEach((symbol, i) => {
        // ไม่วาด chart ถ้า symbol ถูกปิด
        if (symbolData[symbol] && isSymbolEnabled(symbol)) {
          drawChart(i, symbolData[symbol])
        }
      })
      drawPipCanvas()
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [symbolData, symbolConfigs, drawChart, drawPipCanvas])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Hidden PiP elements */}
      <canvas ref={pipCanvasRef} className="hidden" />
      <video ref={pipVideoRef} className="hidden" muted playsInline controls={false} />

      {/* Header Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room</h1>
          <p className="text-sm text-gray-500">สัญญาณเทรด AI Real-time</p>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <span className={`px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase ${
            dataMode === 'live_data' || dataMode === 'live'
              ? 'bg-emerald-500 text-white'
              : 'bg-orange-500 text-white'
          }`}>
            {dataMode === 'live_data' || dataMode === 'live' ? 'LIVE' : 'DEMO'}
          </span>

          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}></span>
            <span className="hidden md:inline text-xs text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {pipSupported && (
            <button
              onClick={togglePip}
              className={`flex items-center space-x-1 md:space-x-2 px-2 md:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isPipActive
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              <span className="hidden md:inline">{isPipActive ? 'ปิด PiP' : 'PiP'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Signal Charts - Grid 2x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[#1a1a1a] p-[1px] rounded-xl overflow-hidden">
        {SYMBOLS.map((symbol, i) => (
          <div key={symbol} className="bg-[#0a0a0a] relative" style={{ aspectRatio: '16/9' }}>
            {/* Title overlay - ซ่อนถ้าปิด */}
            {isSymbolEnabled(symbol) && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-center">
                <span className="text-[#00E676] font-mono text-xs md:text-sm font-bold tracking-wide">
                  {DISPLAY_NAMES[i]}  |  {formatTime(symbolData[symbol]?.countdown || globalCountdown)}
                </span>
              </div>
            )}

            {/* Canvas container */}
            <div ref={el => { containerRefs.current[i] = el }} className="w-full h-full">
              <canvas ref={el => { canvasRefs.current[i] = el }} className="w-full h-full" />
            </div>

            {/* Loading state - เฉพาะตอนเปิด */}
            {!symbolData[symbol] && isSymbolEnabled(symbol) && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-500 text-xs">Loading...</p>
                </div>
              </div>
            )}

            {/* ✅ Maintenance Overlay - ทึบ 100% */}
            {!isSymbolEnabled(symbol) && (
              <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center">
                {/* Icon */}
                <div className="w-16 h-16 mb-4 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-700">
                  <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                
                <p className="text-white text-base md:text-lg font-medium mb-2">
                  ปิดปรับปรุงชั่วคราว
                </p>
                <p className="text-zinc-500 text-xs md:text-sm">
                  ขออภัยในความไม่สะดวก
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 md:space-x-8 text-xs md:text-sm">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 20 24" fill="#00E676">
            <path d="M10 0 L4 8 L7 8 L7 24 L13 24 L13 8 L16 8 Z" />
          </svg>
          <span className="text-gray-500">CALL</span>
        </div>
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 20 24" fill="#FF1744">
            <path d="M10 24 L4 16 L7 16 L7 0 L13 0 L13 16 L16 16 Z" />
          </svg>
          <span className="text-gray-500">PUT</span>
        </div>
      </div>

      {/* PiP Tip */}
      {pipSupported && (
        <p className="text-center text-xs text-gray-400">
          💡 กดปุ่ม <span className="text-emerald-500 font-medium">PiP</span> เพื่อให้กราฟลอยทับแอปเทรด
        </p>
      )}
    </div>
  )
}