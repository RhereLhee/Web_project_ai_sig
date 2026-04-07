// components/SignalRoomContent.tsx
"use client"

import { useEffect, useRef, useCallback } from "react"
import { usePip } from "@/components/PipProvider"

// ============================================
// CONFIGURATION
// ============================================

const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'EURGBPm', 'EURJPYm']
const DISPLAY_NAMES = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'EURGBP', 'EURJPY']
const BARS_TO_SHOW = 10

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

interface User {
  signalSubscription?: {
    endDate: Date
  }
}

interface SignalRoomContentProps {
  user: User
}

export function SignalRoomContent({ user }: SignalRoomContentProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null, null, null])
  const containerRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null, null])

  // Use global PiP context
  const {
    connected,
    dataMode,
    symbolData,
    symbolConfigs,
    globalCountdown,
    isPipActive,
    isPipSupported,
    togglePip,
  } = usePip()

  // Check if symbol is enabled
  const isSymbolEnabled = useCallback((symbol: string) => {
    return symbolConfigs[symbol]?.enabled ?? true
  }, [symbolConfigs])

  // Draw arrow with tail
  const drawArrowWithTail = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    isCall: boolean,
    color: string,
    size: number
  ) => {
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
  }, [])

  // Draw chart content
  const drawChartContent = useCallback((
    ctx: CanvasRenderingContext2D,
    data: any,
    symbol: string,
    width: number,
    height: number
  ) => {
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    const candles = data.candles?.slice(-BARS_TO_SHOW) || []
    if (candles.length === 0) return

    let minPrice = Math.min(...candles.map((c: any) => c.low))
    let maxPrice = Math.max(...candles.map((c: any) => c.high))

    const priceRange = maxPrice - minPrice
    const pricePadding = priceRange * 0.18
    minPrice -= pricePadding
    maxPrice += pricePadding

    const margin = { top: 30, bottom: 10, left: 50, right: 55 }
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
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'

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

      ctx.fillStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(`► ${lastCandle.close.toFixed(decimals)}`, width - margin.right + 5, currentY - 10)
    }

    // Draw signals
    const activeSignal = data.active_signal
    if (activeSignal?.trades) {
      const arrowSize = 14

      activeSignal.trades.forEach((trade: any) => {
        const tradeIndex = candles.findIndex((c: any) => c.time === trade.entry_time)
        if (tradeIndex === -1) return

        const tradeCandle = candles[tradeIndex]
        const x = indexToX(tradeIndex)
        const isCall = activeSignal.signal === 1 || activeSignal.signal_type === 'CALL'
        const y = isCall
          ? priceToY(tradeCandle.low) + arrowSize * 2 + 5
          : priceToY(tradeCandle.high) - arrowSize * 2 - 5

        const arrowColor = isCall ? COLORS.callArrow : COLORS.putArrow
        drawArrowWithTail(ctx, x, y, isCall, arrowColor, arrowSize)
      })
    }

    // Draw completed sequences
    const completed = data.completed_sequences || []
    completed.forEach((seq: any) => {
      if (!seq.trades) return
      seq.trades.forEach((trade: any) => {
        const tradeIndex = candles.findIndex((c: any) => c.time === trade.entry_time)
        if (tradeIndex === -1) return

        const tradeCandle = candles[tradeIndex]
        const x = indexToX(tradeIndex)
        const isCall = seq.signal === 1 || seq.signal_type === 'CALL'
        const arrowSize = 12
        const y = isCall
          ? priceToY(tradeCandle.low) + arrowSize * 2 + 5
          : priceToY(tradeCandle.high) - arrowSize * 2 - 5

        const arrowColor = isCall ? COLORS.callArrow : COLORS.putArrow
        drawArrowWithTail(ctx, x, y, isCall, arrowColor, arrowSize)
      })
    })
  }, [drawArrowWithTail])

  // Draw main chart
  const drawChart = useCallback((index: number, data: any) => {
    const canvas = canvasRefs.current[index]
    const container = containerRefs.current[index]
    if (!canvas || !container || !data?.candles || data.candles.length === 0) return

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

    drawChartContent(ctx, data, SYMBOLS[index], width, height)
  }, [drawChartContent])

  // Draw all charts when data changes
  useEffect(() => {
    const draw = () => {
      SYMBOLS.forEach((symbol, i) => {
        if (symbolData[symbol] && isSymbolEnabled(symbol)) {
          drawChart(i, symbolData[symbol])
        }
      })
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [symbolData, symbolConfigs, drawChart, isSymbolEnabled])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-gray-900">Signal Room</h1>
          <p className="text-sm text-gray-500">สัญญาณเทรด AI Real-time</p>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <span className={`px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase ${
            connected
              ? 'bg-emerald-500 text-white'
              : 'bg-orange-500 text-white'
          }`}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>

          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}></span>
            <span className="hidden md:inline text-xs text-gray-600">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {isPipSupported && (
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
              <span>{isPipActive ? 'ปิด PiP' : 'PiP'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 Signal Charts - Grid 3x2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#1a1a1a] p-[1px] rounded-xl overflow-hidden">
        {SYMBOLS.map((symbol, i) => {
          const isEnabled = isSymbolEnabled(symbol)

          return (
            <div key={symbol} className="bg-[#0a0a0a] relative" style={{ aspectRatio: '16/9' }}>
              {/* Title overlay */}
              {isEnabled && (
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

              {/* Loading state */}
              {!symbolData[symbol] && isEnabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
                  <div className="text-center">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-gray-500 text-xs">Loading...</p>
                  </div>
                </div>
              )}

              {/* Maintenance Overlay */}
              {!isEnabled && (
                <div className="absolute inset-0 z-20 bg-black flex flex-col items-center justify-center">
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
          )
        })}
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
      {isPipSupported && (
        <p className="text-center text-xs text-gray-400">
          💡 กดปุ่ม <span className="text-emerald-500 font-medium">PiP</span> เพื่อให้กราฟลอยทับแอปเทรด (รองรับทุกอุปกรณ์)
          {isPipActive && <span className="text-emerald-400 ml-1">(กำลังใช้งาน - ทำงานต่อแม้เปลี่ยนหน้า)</span>}
        </p>
      )}
    </div>
  )
}