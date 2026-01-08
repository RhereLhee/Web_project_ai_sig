"use client"

import { useEffect, useRef, useState, useCallback } from "react"

// ============================================
// CONFIGURATION
// ============================================
const API_URL = 'https://trading-api-83hs.onrender.com'
const UPDATE_INTERVAL = 1000
const BARS_TO_SHOW = 20

const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']
const DISPLAY_NAMES = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY']

const COLORS = {
  background: '#0a0a0a',
  up: '#00C853',
  down: '#F44336',
  callArrow: '#00E676',
  putArrow: '#FF1744',
  lossArrow: '#757575',
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
  const [globalCountdown, setGlobalCountdown] = useState(0)
  const [connected, setConnected] = useState(false)
  const [dataMode, setDataMode] = useState('mock')
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
    const pricePadding = priceRange * 0.15
    minPrice -= pricePadding
    maxPrice += pricePadding

    const margin = isForPip 
      ? { top: 50, bottom: 15, left: 15, right: 90 }
      : { top: 30, bottom: 10, left: 50, right: 55 }
    
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const totalBarSpace = chartWidth * 0.9
    const barTotalWidth = totalBarSpace / BARS_TO_SHOW
    const barBodyWidth = barTotalWidth * 0.8
    const startOffset = chartWidth * 0.05

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

      const bodyTop = priceToY(Math.max(c.open, c.close))
      const bodyBottom = priceToY(Math.min(c.open, c.close))
      const bodyHeight = Math.max(isForPip ? 2 : 1, bodyBottom - bodyTop)

      ctx.fillStyle = color
      ctx.fillRect(x - barBodyWidth / 2, bodyTop, barBodyWidth, bodyHeight)
    }

    // Draw signals
    const chartPriceRange = maxPrice - minPrice
    const fixedOffset = chartPriceRange * 0.03

    if (data.active_signal?.trades) {
      const sig = data.active_signal
      const isCall = sig.signal === 1 || sig.signal_type === 'CALL'

      for (const trade of sig.trades) {
        let tradeIdx = candles.findIndex(c => c.time === trade.entry_time)
        if (tradeIdx < 0 && trade.is_realtime) tradeIdx = candles.length - 1

        if (tradeIdx >= 0 && tradeIdx < candles.length) {
          const c = candles[tradeIdx]
          const x = indexToX(tradeIdx)
          const y = isCall ? priceToY(c.low - fixedOffset) : priceToY(c.high + fixedOffset)

          let color: string
          if (trade.is_realtime) color = '#FFFFFF'
          else if (trade.win === false) color = COLORS.lossArrow
          else color = isCall ? COLORS.callArrow : COLORS.putArrow

          drawArrow(ctx, x, y, isCall, color, isForPip ? 18 : 12)
        }
      }
    }

    if (data.completed_sequences) {
      for (const seq of data.completed_sequences) {
        if (seq.trades) {
          const isCall = seq.signal_type === 'CALL'
          for (const trade of seq.trades) {
            const tradeIdx = candles.findIndex(c => c.time === trade.entry_time)
            if (tradeIdx >= 0 && tradeIdx < candles.length) {
              const c = candles[tradeIdx]
              const x = indexToX(tradeIdx)
              const y = isCall ? priceToY(c.low - fixedOffset) : priceToY(c.high + fixedOffset)
              const color = trade.win ? (isCall ? COLORS.callArrow : COLORS.putArrow) : COLORS.lossArrow
              drawArrow(ctx, x, y, isCall, color, isForPip ? 18 : 12)
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
    ctx.lineWidth = size > 15 ? 2.5 : 1.5
    ctx.stroke()
    ctx.restore()
  }

  // Draw PiP canvas - กราฟปกติ 2x2
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
      ctx.strokeRect(offsetX + 1, offsetY + 1, cellWidth - 2, cellHeight - 2)

      // Header - Symbol name
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

      // Draw chart
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

  }, [symbolData, globalCountdown])

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
        if (symbolData[symbol]) {
          drawChart(i, symbolData[symbol])
        }
      })
      drawPipCanvas()
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [symbolData, drawChart, drawPipCanvas])

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
          {/* Mode Badge */}
          <span className={`px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase ${
            dataMode === 'live_data' || dataMode === 'live'
              ? 'bg-emerald-500 text-white'
              : 'bg-orange-500 text-white'
          }`}>
            {dataMode === 'live_data' || dataMode === 'live' ? 'LIVE' : 'DEMO'}
          </span>

          {/* Connection Status */}
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}></span>
            <span className="hidden md:inline text-xs text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* PiP Button */}
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
            {/* Title overlay */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-center">
              <span className="text-[#00E676] font-mono text-xs md:text-sm font-bold tracking-wide">
                {DISPLAY_NAMES[i]}  |  {formatTime(symbolData[symbol]?.countdown || globalCountdown)}
              </span>
            </div>

            {/* Canvas container */}
            <div ref={el => { containerRefs.current[i] = el }} className="w-full h-full">
              <canvas ref={el => { canvasRefs.current[i] = el }} className="w-full h-full" />
            </div>

            {/* Loading state */}
            {!symbolData[symbol] && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-500 text-xs">Loading...</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-4 md:space-x-6 text-xs md:text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#00E676]"></div>
          <span className="text-gray-500">CALL</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#FF1744]"></div>
          <span className="text-gray-500">PUT</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 bg-[#757575] rounded-sm"></div>
          <span className="text-gray-500">Loss</span>
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