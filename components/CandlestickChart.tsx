"use client"

import { useEffect, useRef } from 'react'

interface CandlestickChartProps {
  pair: string
  direction: 'BUY' | 'SELL'
}

export function CandlestickChart({ pair, direction }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Generate mock candlestick data
    const data = generateCandlestickData(30)
    
    // Render chart using Canvas
    renderChart(chartContainerRef.current, data, direction)
  }, [pair, direction])

  return (
    <div ref={chartContainerRef} className="w-full h-full relative">
      {/* Pair name overlay */}
      <div className="absolute top-3 left-3 z-10">
        <h3 className="text-emerald-400 font-bold text-lg">{pair}</h3>
        <p className="text-gray-400 text-xs">04:50</p>
      </div>
    </div>
  )
}

function generateCandlestickData(count: number) {
  const data = []
  let price = Math.random() * 100 + 100
  
  for (let i = 0; i < count; i++) {
    const open = price
    const close = price + (Math.random() - 0.5) * 2
    const high = Math.max(open, close) + Math.random() * 0.5
    const low = Math.min(open, close) - Math.random() * 0.5
    
    data.push({ open, high, low, close })
    price = close
  }
  
  return data
}

function renderChart(
  container: HTMLDivElement, 
  data: { open: number; high: number; low: number; close: number }[],
  direction: 'BUY' | 'SELL'
) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = container.getBoundingClientRect()
  canvas.width = rect.width * 2
  canvas.height = rect.height * 2
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  
  container.innerHTML = ''
  container.appendChild(canvas)

  ctx.scale(2, 2)

  const width = rect.width
  const height = rect.height
  const candleWidth = width / data.length
  const padding = 40

  // Find min/max
  let min = Infinity
  let max = -Infinity
  data.forEach(d => {
    min = Math.min(min, d.low)
    max = Math.max(max, d.high)
  })
  
  const range = max - min
  const yScale = (price: number) => height - padding - ((price - min) / range) * (height - 2 * padding)

  // Draw grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 5; i++) {
    const y = padding + (i * (height - 2 * padding) / 4)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Draw candlesticks
  data.forEach((candle, i) => {
    const x = i * candleWidth + candleWidth / 2
    const isGreen = candle.close > candle.open

    // Wick
    ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, yScale(candle.high))
    ctx.lineTo(x, yScale(candle.low))
    ctx.stroke()

    // Body
    const bodyTop = yScale(Math.max(candle.open, candle.close))
    const bodyBottom = yScale(Math.min(candle.open, candle.close))
    const bodyHeight = bodyBottom - bodyTop

    ctx.fillStyle = isGreen ? '#10b981' : '#ef4444'
    ctx.fillRect(
      x - candleWidth * 0.3,
      bodyTop,
      candleWidth * 0.6,
      Math.max(bodyHeight, 1)
    )
  })

  // Draw signal indicator
  const lastCandle = data[data.length - 1]
  const indicatorY = yScale(lastCandle.close)
  
  ctx.fillStyle = direction === 'BUY' ? '#10b981' : '#ef4444'
  ctx.beginPath()
  if (direction === 'BUY') {
    // Up triangle
    ctx.moveTo(width - 20, indicatorY + 10)
    ctx.lineTo(width - 10, indicatorY - 10)
    ctx.lineTo(width - 30, indicatorY - 10)
  } else {
    // Down triangle
    ctx.moveTo(width - 20, indicatorY - 10)
    ctx.lineTo(width - 10, indicatorY + 10)
    ctx.lineTo(width - 30, indicatorY + 10)
  }
  ctx.closePath()
  ctx.fill()
}