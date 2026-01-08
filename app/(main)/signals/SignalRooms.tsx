"use client"

import { useEffect, useRef, useState, useCallback } from "react"

const API_URL = 'https://trading-api-83hs.onrender.com'
const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']
const DISPLAY_NAMES = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY']
const BARS_TO_SHOW = 20

// PiP Canvas - ขนาดใหญ่
const PIP_WIDTH = 800
const PIP_HEIGHT = 600

const COLORS = {
  background: '#0a0a0a',
  up: '#00C853',
  down: '#F44336',
  callArrow: '#00E676',
  putArrow: '#FF1744',
  lossArrow: '#757575',
  grid: '#1a1a1a',
  axisText: '#888888'
}

interface SignalData {
  candles: Array<{
    time: string
    open: number
    high: number
    low: number
    close: number
  }>
  countdown?: number
  active_signal?: any
  completed_sequences?: any[]
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
  const [countdown, setCountdown] = useState(0)
  const [connected, setConnected] = useState(false)
  const [isPipActive, setIsPipActive] = useState(false)
  const [pipSupported, setPipSupported] = useState(false)

  // Check PiP support
  useEffect(() => {
    setPipSupported('pictureInPictureEnabled' in document && (document as any).pictureInPictureEnabled)
  }, [])

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch(`${API_URL}/api/realtime/all`)
        if (!res.ok) throw new Error('Failed')
        
        const data = await res.json()
        setConnected(true)
        
        if (data.countdown !== undefined) setCountdown(data.countdown)
        if (data.symbols) setSymbolData(data.symbols)
      } catch {
        setConnected(false)
      }
    }

    loadData()
    const interval = setInterval(loadData, 1000)
    const countdownInterval = setInterval(() => {
      setCountdown(prev => prev > 0 ? prev - 1 : 299)
    }, 1000)

    return () => {
      clearInterval(interval)
      clearInterval(countdownInterval)
    }
  }, [])

  // Draw PiP canvas (2x2 grid)
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
      const data = symbolData[symbol]
      if (!data || !data.candles || data.candles.length === 0) return

      const col = i % 2
      const row = Math.floor(i / 2)
      const offsetX = col * cellWidth
      const offsetY = row * cellHeight

      // Border
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 2
      ctx.strokeRect(offsetX, offsetY, cellWidth, cellHeight)

      // Title
      ctx.fillStyle = COLORS.callArrow
      ctx.font = 'bold 16px monospace'
      ctx.fillText(DISPLAY_NAMES[i], offsetX + 12, offsetY + 25)

      // Countdown
      const cd = data.countdown || countdown
      const mins = Math.floor(cd / 60)
      const secs = cd % 60
      ctx.fillStyle = '#fff'
      ctx.font = '14px monospace'
      ctx.fillText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, offsetX + cellWidth - 55, offsetY + 25)

      // Chart
      drawMiniChart(ctx, data, symbol, offsetX + 8, offsetY + 35, cellWidth - 16, cellHeight - 50)
    })
  }, [symbolData, countdown])

  const drawMiniChart = (
    ctx: CanvasRenderingContext2D, 
    data: SignalData, 
    symbol: string,
    offsetX: number, 
    offsetY: number, 
    width: number, 
    height: number
  ) => {
    const candles = data.candles.slice(-BARS_TO_SHOW)
    if (candles.length === 0) return

    let minPrice = Math.min(...candles.map(c => c.low))
    let maxPrice = Math.max(...candles.map(c => c.high))
    const priceRange = maxPrice - minPrice
    minPrice -= priceRange * 0.1
    maxPrice += priceRange * 0.1

    const barWidth = (width * 0.9) / BARS_TO_SHOW
    const barBodyWidth = barWidth * 0.7

    const priceToY = (price: number) => {
      const ratio = (price - minPrice) / (maxPrice - minPrice)
      return offsetY + height * (1 - ratio)
    }

    const indexToX = (i: number) => offsetX + width * 0.05 + (i + 0.5) * barWidth

    // Draw candles
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const x = indexToX(i)
      const isUp = c.close >= c.open
      const color = isUp ? COLORS.up : COLORS.down

      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, priceToY(c.high))
      ctx.lineTo(x, priceToY(c.low))
      ctx.stroke()

      const bodyTop = priceToY(Math.max(c.open, c.close))
      const bodyBottom = priceToY(Math.min(c.open, c.close))
      const bodyHeight = Math.max(1, bodyBottom - bodyTop)

      ctx.fillStyle = color
      ctx.fillRect(x - barBodyWidth / 2, bodyTop, barBodyWidth, bodyHeight)
    }

    // Draw signals
    const fixedOffset = (maxPrice - minPrice) * 0.05

    if (data.active_signal?.trades) {
      const isCall = data.active_signal.signal === 1 || data.active_signal.signal_type === 'CALL'
      
      for (const trade of data.active_signal.trades) {
        let idx = candles.findIndex(c => c.time === trade.entry_time)
        if (idx < 0 && trade.is_realtime) idx = candles.length - 1
        
        if (idx >= 0) {
          const c = candles[idx]
          const x = indexToX(idx)
          const y = isCall ? priceToY(c.low - fixedOffset) : priceToY(c.high + fixedOffset)
          const color = trade.is_realtime ? '#FFFFFF' : 
                        trade.win === false ? COLORS.lossArrow : 
                        (isCall ? COLORS.callArrow : COLORS.putArrow)
          drawArrow(ctx, x, y, isCall, color, 7)
        }
      }
    }

    // Completed sequences
    if (data.completed_sequences) {
      for (const seq of data.completed_sequences) {
        if (seq.trades) {
          const isCall = seq.signal_type === 'CALL'
          for (const trade of seq.trades) {
            const idx = candles.findIndex(c => c.time === trade.entry_time)
            if (idx >= 0) {
              const c = candles[idx]
              const x = indexToX(idx)
              const y = isCall ? priceToY(c.low - fixedOffset) : priceToY(c.high + fixedOffset)
              const color = trade.win ? (isCall ? COLORS.callArrow : COLORS.putArrow) : COLORS.lossArrow
              drawArrow(ctx, x, y, isCall, color, 7)
            }
          }
        }
      }
    }
  }

  const drawArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, isUp: boolean, color: string, size: number) => {
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    if (isUp) {
      ctx.moveTo(x, y - size)
      ctx.lineTo(x - size * 0.6, y + size * 0.3)
      ctx.lineTo(x + size * 0.6, y + size * 0.3)
    } else {
      ctx.moveTo(x, y + size)
      ctx.lineTo(x - size * 0.6, y - size * 0.3)
      ctx.lineTo(x + size * 0.6, y - size * 0.3)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

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
        
        const pipWindow = await (video as any).requestPictureInPicture()
        if (pipWindow) {
          pipWindow.width = 500
          pipWindow.height = 375
        }
        
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
        if (symbolData[symbol] && canvasRefs.current[i] && containerRefs.current[i]) {
          drawChart(canvasRefs.current[i]!, containerRefs.current[i]!, symbolData[symbol], symbol)
        }
      })
      if (pipCanvasRef.current && Object.keys(symbolData).length > 0) {
        drawPipCanvas()
      }
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [symbolData, countdown, drawPipCanvas])

  const drawChart = (canvas: HTMLCanvasElement, container: HTMLDivElement, data: SignalData, symbol: string) => {
    const ctx = canvas.getContext('2d')
    if (!ctx || !data.candles || data.candles.length === 0) return

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

    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    const candles = data.candles.slice(-BARS_TO_SHOW)
    if (candles.length === 0) return

    let minPrice = Math.min(...candles.map(c => c.low))
    let maxPrice = Math.max(...candles.map(c => c.high))
    const priceRange = maxPrice - minPrice
    minPrice -= priceRange * 0.15
    maxPrice += priceRange * 0.15

    const margin = { top: 30, bottom: 10, left: 10, right: 55 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const barTotalWidth = (chartWidth * 0.9) / BARS_TO_SHOW
    const barBodyWidth = barTotalWidth * 0.8

    const priceToY = (price: number) => margin.top + chartHeight * (1 - (price - minPrice) / (maxPrice - minPrice))
    const indexToX = (i: number) => margin.left + chartWidth * 0.05 + (i + 0.5) * barTotalWidth

    // Y-axis labels
    ctx.fillStyle = COLORS.axisText
    ctx.font = '10px monospace'
    const decimals = symbol.includes('JPY') ? 3 : 5
    for (let i = 0; i <= 6; i++) {
      const price = minPrice + (maxPrice - minPrice) * (i / 6)
      const y = priceToY(price)
      ctx.fillText(price.toFixed(decimals), width - margin.right + 5, y)
      
      ctx.strokeStyle = COLORS.grid
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(margin.left, y)
      ctx.lineTo(width - margin.right, y)
      ctx.stroke()
    }

    // Candles
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const x = indexToX(i)
      const isUp = c.close >= c.open
      const color = isUp ? COLORS.up : COLORS.down

      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, priceToY(c.high))
      ctx.lineTo(x, priceToY(c.low))
      ctx.stroke()

      const bodyTop = priceToY(Math.max(c.open, c.close))
      const bodyHeight = Math.max(1, priceToY(Math.min(c.open, c.close)) - bodyTop)
      ctx.fillStyle = color
      ctx.fillRect(x - barBodyWidth / 2, bodyTop, barBodyWidth, bodyHeight)
    }

    // Signals
    const fixedOffset = (maxPrice - minPrice) * 0.03

    if (data.active_signal?.trades) {
      const isCall = data.active_signal.signal === 1 || data.active_signal.signal_type === 'CALL'
      for (const trade of data.active_signal.trades) {
        let idx = candles.findIndex(c => c.time === trade.entry_time)
        if (idx < 0 && trade.is_realtime) idx = candles.length - 1
        if (idx >= 0) {
          const c = candles[idx]
          const x = indexToX(idx)
          const y = isCall ? priceToY(c.low - fixedOffset) : priceToY(c.high + fixedOffset)
          const color = trade.is_realtime ? '#FFFFFF' : trade.win === false ? COLORS.lossArrow : (isCall ? COLORS.callArrow : COLORS.putArrow)
          drawArrowMain(ctx, x, y, isCall, color)
        }
      }
    }

    if (data.completed_sequences) {
      for (const seq of data.completed_sequences) {
        if (seq.trades) {
          const isCall = seq.signal_type === 'CALL'
          for (const trade of seq.trades) {
            const idx = candles.findIndex(c => c.time === trade.entry_time)
            if (idx >= 0) {
              const c = candles[idx]
              const x = indexToX(idx)
              const y = isCall ? priceToY(c.low - fixedOffset) : priceToY(c.high + fixedOffset)
              const color = trade.win ? (isCall ? COLORS.callArrow : COLORS.putArrow) : COLORS.lossArrow
              drawArrowMain(ctx, x, y, isCall, color)
            }
          }
        }
      }
    }
  }

  const drawArrowMain = (ctx: CanvasRenderingContext2D, x: number, y: number, isUp: boolean, color: string) => {
    const size = 12
    ctx.save()
    ctx.fillStyle = color
    ctx.beginPath()
    if (isUp) {
      ctx.moveTo(x, y - size)
      ctx.lineTo(x - size * 0.7, y + size * 0.4)
      ctx.lineTo(x + size * 0.7, y + size * 0.4)
    } else {
      ctx.moveTo(x, y + size)
      ctx.lineTo(x - size * 0.7, y - size * 0.4)
      ctx.lineTo(x + size * 0.7, y - size * 0.4)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()
  }

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Hidden PiP elements */}
      <canvas ref={pipCanvasRef} className="hidden" />
      <video ref={pipVideoRef} className="hidden" muted playsInline controls={false} />

      {/* Header Bar - เหมือนก่อนซื้อ + PiP button */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room</h1>
          <p className="text-sm text-gray-500">สัญญาณเทรด AI Real-time</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className="hidden md:flex items-center space-x-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className="text-gray-600">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Countdown */}
          <div className="bg-gray-900 text-emerald-400 font-mono text-sm md:text-base px-3 py-1.5 rounded-lg">
            {formatTime(countdown)}
          </div>
          
          {/* PiP Button */}
          {pipSupported && (
            <button
              onClick={togglePip}
              className={`flex items-center space-x-1 md:space-x-2 px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition-all ${
                isPipActive 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h6m4-10h6m0 0v6m0-6l-7 7" />
              </svg>
              <span className="hidden md:inline">{isPipActive ? 'ปิด PiP' : 'เปิด PiP'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Signal Rooms - Grid 2x2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {SYMBOLS.map((symbol, i) => (
          <div key={symbol} className="signal-room relative bg-[#0a0a0a] rounded-xl overflow-hidden" style={{ aspectRatio: '16/10' }}>
            {/* Header overlay */}
            <div className="absolute top-2 left-0 right-0 z-10 flex items-center justify-between px-3">
              <span className="text-emerald-400 font-mono text-sm font-bold">{DISPLAY_NAMES[i]}</span>
              <span className="text-white/70 font-mono text-xs">{formatTime(symbolData[symbol]?.countdown || countdown)}</span>
            </div>
            
            {/* Canvas container */}
            <div ref={el => { containerRefs.current[i] = el }} className="w-full h-full">
              <canvas ref={el => { canvasRefs.current[i] = el }} className="w-full h-full" />
            </div>

            {/* Loading state */}
            {!symbolData[symbol] && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-400 text-xs">กำลังโหลด...</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex justify-center space-x-4 md:space-x-6 text-xs md:text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-emerald-400"></div>
          <span className="text-gray-600">CALL</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-red-400"></div>
          <span className="text-gray-600">PUT</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-gray-500 rounded-sm"></div>
          <span className="text-gray-600">Loss</span>
        </div>
      </div>

      {/* PiP Tip */}
      {pipSupported && (
        <p className="text-center text-xs text-gray-400">
          💡 กดปุ่ม <span className="text-emerald-500 font-medium">PiP</span> เพื่อให้กราฟลอยทับหน้าต่างอื่น
        </p>
      )}
    </div>
  )
}