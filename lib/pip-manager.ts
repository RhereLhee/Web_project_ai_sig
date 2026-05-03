// lib/pip-manager.ts
// Global PiP Manager - Canvas + Video + Render Loop
// ไม่ผูกกับ React lifecycle - ทำงานต่อเนื่องแม้ component unmount

import { signalService, type SignalData, type SymbolConfig, type RealtimeData } from './signal-service'

// ============================================
// CONFIGURATION
// ============================================

const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm', 'EURGBPm', 'EURJPYm']
const DISPLAY_NAMES = ['AUDUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'EURGBP', 'EURJPY']
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

// PiP Mode:
// 'hls'    = HLS video PiP (ลอยเหนือแอปจริง ทุก platform)
// 'native' = Canvas captureStream PiP (Desktop Chrome fallback)
// 'popup'  = Overlay fallback (ลอยในเว็บเท่านั้น)
type PipMode = 'hls' | 'native' | 'popup'

class PipManager {
  private static instance: PipManager | null = null

  // Canvas & Video
  private canvas: HTMLCanvasElement | null = null
  private video: HTMLVideoElement | null = null
  private stream: MediaStream | null = null
  private ctx: CanvasRenderingContext2D | null = null

  // HLS Video element (separate from canvas video)
  private hlsVideo: HTMLVideoElement | null = null

  // Popup overlay (fallback สำหรับมือถือ)
  private popupCanvas: HTMLCanvasElement | null = null
  private popupCtx: CanvasRenderingContext2D | null = null

  // State
  private isActive = false
  private isSupported = false
  private pipMode: PipMode = 'hls'
  private renderLoopId: number | null = null
  private lastRenderTime = 0
  private frameInterval = 1000 / PIP_FPS

  // Data (cached from signal service)
  private symbolData: Record<string, SignalData> = {}
  private symbolConfigs: Record<string, SymbolConfig> = {}
  private globalCountdown = 0
  private hlsUrl: string | null = null
  private hlsReady = false // HLS video pre-loaded and ready for instant PiP
  private hlsLoading = false // HLS load/retry cycle in progress
  private hlsRetryTimeoutId: ReturnType<typeof setTimeout> | null = null
  private hlsLoadedDataTimeoutId: ReturnType<typeof setTimeout> | null = null
  private hlsLoadGeneration = 0 // prevents stale closures from affecting new loads
  private mediaSessionIntervalId: ReturnType<typeof setInterval> | null = null

  // Debug overlay (เปิดใช้งานเมื่อ URL มี ?pip_debug)
  private debugOverlay: HTMLDivElement | null = null
  private debugLogEl: HTMLPreElement | null = null
  private debugStateEl: HTMLDivElement | null = null
  private debugRefreshId: ReturnType<typeof setInterval> | null = null
  private logHistory: string[] = []

  // HLS push tracking
  private hlsPushStatus = 'never'   // 'never' | 'ok' | 'fail:...'
  private hlsPushCount = 0
  private hlsPushLastTime = 0

  // Server-side debug info (fetched from /hls/push response or /debug/hls)
  private hlsServerSrc = '?'        // bridge | cached_bridge | frontend_push | mock
  private hlsServerMode = '?'
  private hlsBridgeAge = -1          // seconds since last bridge update
  private hlsBridgeConnected = false
  private hlsServerCountdown = 0
  private hlsCandleCounts: Record<string, number> = {}
  private hlsDebugFetchId: ReturnType<typeof setInterval> | null = null

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
    // รองรับทุก platform — จะลอง HLS Canvas PiP Overlay ตอน start()
    this.pipMode = 'hls'
    this.isSupported = true

    // Cleanup any existing PiP elements (from hot reload or previous instances)
    document.querySelectorAll('[data-pip-manager]').forEach(el => el.remove())

    // Inject global CSS to hide webkit media controls on PiP video
    // Sigzy-style: ซ่อนปุ่มทั้งหมดใน PiP ให้เหลือแค่ดู
    const existingStyle = document.getElementById('pip-hide-controls-css')
    if (existingStyle) existingStyle.remove()
    const style = document.createElement('style')
    style.id = 'pip-hide-controls-css'
    style.textContent = `
      /* ซ่อน webkit media controls ทั้งหมด */
      video[data-pip-manager]::-webkit-media-controls {
        display: none !important;
        -webkit-appearance: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
      }
      video[data-pip-manager]::-webkit-media-controls-panel {
        display: none !important;
        -webkit-appearance: none !important;
        opacity: 0 !important;
      }
      video[data-pip-manager]::-webkit-media-controls-play-button {
        display: none !important;
        -webkit-appearance: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-start-playback-button {
        display: none !important;
        -webkit-appearance: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-current-time-display {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-time-remaining-display {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-timeline {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-seek-back-button {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-seek-forward-button {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-fullscreen-button {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-toggle-closed-captions-button {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-volume-slider {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-mute-button {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-overlay-enclosure {
        display: none !important;
      }
      video[data-pip-manager]::-webkit-media-controls-enclosure {
        display: none !important;
      }
      /* Chrome/Edge PiP controls */
      video[data-pip-manager]::--media-controls-overlay-play-button {
        display: none !important;
      }
    `
    document.head.appendChild(style)

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

    // Create hidden video — ต้องมีขนาดจริง ไม่ใช่ display:none
    // iOS Safari ต้อง "เห็น" video ถึงจะอนุญาต PiP
    this.video = document.createElement('video')
    this.video.muted = true
    this.video.playsInline = true
    this.video.autoplay = true
    this.video.controls = false
    this.video.disablePictureInPicture = false
    this.video.setAttribute('playsinline', '')
    this.video.setAttribute('webkit-playsinline', '')
    this.video.setAttribute('data-pip-manager', 'true')
    // autopictureinpicture — เมื่อ user ปัดออกจาก browser จะเข้า PiP อัตโนมัติ
    this.video.setAttribute('autopictureinpicture', '')
    // ซ่อนแต่ยังมีขนาด (iOS ต้องการ)
    this.video.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;'
    document.body.appendChild(this.video)

    // Setup video events — Standard PiP
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

    // Safari webkit PiP events
    this.video.addEventListener('webkitpresentationmodechanged', () => {
      const mode = (this.video as any)?.webkitPresentationMode
      if (mode === 'picture-in-picture') {
        this.isActive = true
        this.notifyStateListeners(true)
      } else if (mode === 'inline') {
        this.isActive = false
        this.stopRenderLoop()
        this.cleanupStream()
        this.notifyStateListeners(false)
      }
    })

    // เมื่อ user ปัดออกจากหน้าเว็บ auto PiP
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.isActive && this.video) {
        // PiP จะทำงานต่อเมื่อ user ออกจาก browser
      }
    })

    // Subscribe to signal service
    this.subscribeToSignalService()

    // Debug overlay — เปิดได้ใน production ผ่าน ?pip_debug ใน URL
    if (typeof window !== 'undefined' && window.location.search.includes('pip_debug')) {
      this.initDebugOverlay()
    }
  }

  // ============================================
  // DEBUG OVERLAY
  // ============================================

  private debugServerEl: HTMLDivElement | null = null

  private initDebugOverlay(): void {
    if (this.debugOverlay) return
    const div = document.createElement('div')
    div.id = 'pip-debug-overlay'
    div.style.cssText = [
      'position:fixed', 'top:8px', 'left:8px', 'z-index:999999',
      'background:rgba(0,0,0,0.85)', 'color:#0f0', 'font:11px/1.4 monospace',
      'padding:8px', 'border-radius:6px', 'max-width:360px',
      'pointer-events:none', 'white-space:pre-wrap', 'word-break:break-all',
    ].join(';')

    const title = document.createElement('div')
    title.style.cssText = 'color:#fff;font-weight:bold;margin-bottom:4px'
    title.textContent = '── PiP Debug ──'

    this.debugStateEl = document.createElement('div')
    this.debugStateEl.style.cssText = 'color:#ff0;margin-bottom:4px'

    // Server-side info section
    this.debugServerEl = document.createElement('div')
    this.debugServerEl.style.cssText = 'color:#0ff;margin-bottom:4px;border-top:1px solid #333;padding-top:4px'

    this.debugLogEl = document.createElement('pre')
    this.debugLogEl.style.cssText = 'margin:0;color:#0f0;font-size:10px;max-height:160px;overflow:hidden'

    div.appendChild(title)
    div.appendChild(this.debugStateEl)
    div.appendChild(this.debugServerEl)
    div.appendChild(this.debugLogEl)
    document.body.appendChild(div)
    this.debugOverlay = div

    // Refresh state every second
    this.debugRefreshId = setInterval(() => this.refreshDebug(), 1000)
    // Fetch server debug every 5 seconds
    this.hlsDebugFetchId = setInterval(() => this.fetchServerDebug(), 5000)
    this.fetchServerDebug()
    this.plog('debug overlay ready')
  }

  private plog(msg: string): void {
    const ts = new Date().toTimeString().slice(0, 8)
    const line = `${ts} ${msg}`
    console.log(`[PiP] ${line}`)
    if (!this.debugLogEl) return
    this.logHistory.push(line)
    if (this.logHistory.length > 20) this.logHistory.shift()
    this.debugLogEl.textContent = this.logHistory.join('\n')
  }

  private refreshDebug(): void {
    if (!this.debugStateEl) return
    const v = this.hlsVideo
    const seekable = v && v.seekable.length > 0
      ? `${v.seekable.start(0).toFixed(1)}-${v.seekable.end(v.seekable.length - 1).toFixed(1)}s`
      : 'empty'
    const netLabels = ['EMPTY','IDLE','LOADING','NO_SRC']
    const rsLabels = ['NOTHING','METADATA','CURRENT','FUTURE','ENOUGH']
    const rs = v?.readyState ?? -1
    const net = v?.networkState ?? -1
    // Data freshness — frontend side
    const liveData = signalService.getData()
    const symCount = liveData ? Object.keys(liveData.symbols || {}).length : 0
    const stale = liveData?.stale ? '(STALE)' : ''
    // Push age
    const pushAge = this.hlsPushLastTime > 0
      ? `${Math.round((Date.now() - this.hlsPushLastTime) / 1000)}s ago`
      : 'never'
    // HLS URL summary (last 25 chars)
    const hlsShort = this.hlsUrl ? this.hlsUrl.slice(-25) : 'none'

    // Frontend candle counts for comparison
    const frontCandles: string[] = []
    if (liveData?.symbols) {
      for (const sym of SYMBOLS) {
        const sd = liveData.symbols[sym]
        const cnt = sd?.candles?.length ?? 0
        frontCandles.push(`${sym.replace('m','').slice(0,3)}:${cnt}`)
      }
    }

    this.debugStateEl.textContent = [
      `mode:${this.pipMode} | active:${this.isActive}`,
      `ready:${this.hlsReady} | loading:${this.hlsLoading} gen:${this.hlsLoadGeneration}`,
      `rs:${rs}(${rsLabels[rs]??'?'}) net:${net}(${netLabels[net]??'?'})`,
      `t:${v ? v.currentTime.toFixed(2)+'s' : '?'} | dur:${v ? (isFinite(v.duration)?v.duration.toFixed(1):'∞') : '?'}`,
      `buf:${this.fmtBuf(v!)} | seek:${seekable}`,
      `paused:${v?.paused??'?'} | ended:${v?.ended??'?'}`,
      `err:${(v as any)?.error?.code ?? 'none'}`,
      `data:${symCount}sym cd:${this.globalCountdown}s ${stale}`,
      `push:${this.hlsPushStatus} (${pushAge})`,
      `front_candles:${frontCandles.join(' ') || 'none'}`,
      `url:…${hlsShort}`,
    ].join('\n')

    // Update server section
    if (this.debugServerEl) {
      const srcColor = this.hlsServerSrc === 'bridge' ? '🟢' :
                       this.hlsServerSrc === 'mock' ? '🔴' :
                       this.hlsServerSrc === 'frontend_push' ? '🟡' :
                       this.hlsServerSrc === 'cached_bridge' ? '🟠' : '⚪'
      const serverCandles: string[] = []
      for (const sym of SYMBOLS) {
        const cnt = this.hlsCandleCounts[sym] ?? this.hlsCandleCounts[sym.replace('m','')] ?? '?'
        serverCandles.push(`${sym.replace('m','').slice(0,3)}:${cnt}`)
      }
      this.debugServerEl.textContent = [
        `── HLS Server ──`,
        `${srcColor} src:${this.hlsServerSrc} mode:${this.hlsServerMode}`,
        `bridge:${this.hlsBridgeConnected} age:${this.hlsBridgeAge >= 0 ? this.hlsBridgeAge+'s' : 'never'}`,
        `srv_cd:${this.hlsServerCountdown}s`,
        `srv_candles:${serverCandles.join(' ')}`,
      ].join('\n')
    }
  }

  private fetchServerDebug(): void {
    if (!this.hlsUrl) return
    const baseUrl = this.hlsUrl.replace(/\/stream\/.*/, '')
    fetch(`${baseUrl}/debug/hls`, { signal: AbortSignal.timeout(3000) })
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json) return
        this.hlsServerSrc = json.hls_src ?? '?'
        this.hlsServerMode = json.hls_mode ?? '?'
        this.hlsBridgeAge = json.bridge_age_s ?? -1
        this.hlsBridgeConnected = json.bridge_connected ?? false
        this.hlsServerCountdown = json.countdown ?? 0
        if (json.candle_counts) this.hlsCandleCounts = json.candle_counts
      })
      .catch(() => {})
  }

  private subscribeToSignalService(): void {
    // Subscribe to data updates
    this.unsubscribeData = signalService.onData((data: RealtimeData) => {
      if (data.symbols) {
        this.symbolData = data.symbols
      }

      // Update globalCountdown — ลำดับความสำคัญ:
      // 1. top-level countdown (ถ้า server ส่งมา)
      // 2. derive จาก per-symbol countdown (server ส่งแค่ใน symbols[x].countdown)
      if (data.countdown !== undefined) {
        // ตรง PipProvider: ถ้า stale ให้เป็น 0
        this.globalCountdown = data.stale ? 0 : data.countdown
      } else if (data.symbols) {
        // หา countdown จาก symbol แรกที่มีค่า
        for (const sym of Object.values(data.symbols)) {
          if (sym.countdown !== undefined) {
            this.globalCountdown = data.stale ? 0 : sym.countdown
            break
          }
        }
      }

      if (data.hls_url) {
        if (data.hls_url !== this.hlsUrl) {
          this.hlsUrl = data.hls_url
          // Push ก่อน preload — VPS ต้องมี real data ก่อน FFmpeg render segment ที่ iOS จะโหลด
          // ถ้า preload ก่อน VPS ยังใช้ mock → iOS โหลด segment ที่มี mock chart
          if (data.symbols && Object.keys(data.symbols).length > 0) {
            this.hlsPushLastTime = 0  // reset rate-limit ให้ push ได้ทันที
            this.pushDataToHlsServer(data)
          }
          // รอ 2s หลัง push ก่อน preload — ให้ FFmpeg มีเวลา render segments ด้วย real data
          setTimeout(() => {
            if (this.hlsUrl === data.hls_url) this.preloadHlsVideo()
          }, 2000)
        } else if (!this.hlsReady && !this.hlsLoading && this.hlsUrl) {
          this.preloadHlsVideo()
        }
      }

      // Push ข้อมูลจริงจาก WebSocket ไปให้ VPS render เป็น HLS frame
      if (data.symbols && Object.keys(data.symbols).length > 0 && this.hlsUrl) {
        this.pushDataToHlsServer(data)
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
      // PiP not supported
      return
    }

    if (this.isActive) {
      await this.stop()
    } else {
      await this.start()
    }
  }

  async start(): Promise<void> {
    if (this.isActive) return

    // Sync ข้อมูลล่าสุดจาก signalService ก่อนเปิด PiP
    // ป้องกัน popup render loop วาด "Loading..." เพราะ listener ยังไม่ fire
    const currentData = signalService.getData()
    if (currentData) {
      if (currentData.symbols) this.symbolData = currentData.symbols
      if (currentData.countdown !== undefined) {
        this.globalCountdown = currentData.stale ? 0 : currentData.countdown
      } else {
        for (const sym of Object.values(currentData.symbols || {})) {
          if (sym.countdown !== undefined) {
            this.globalCountdown = currentData.stale ? 0 : sym.countdown
            break
          }
        }
      }
    }

    const android = this.isAndroid()

    // HLS PiP — ลองทุก platform รวมถึง iOS
    // iOS Safari รองรับ HLS + webkit PiP นี่คือ path ที่ดีที่สุดสำหรับ iOS
    // Android/Desktop ก็รองรับ HLS video PiP ลอยเหนือ app ได้เลย
    console.log(`[PiP] start() — hlsUrl=${!!this.hlsUrl} hlsReady=${this.hlsReady} android=${android} iOS=${this.isIOS()}`)

    const hlsSuccess = await this.startHlsPip()
    if (hlsSuccess) {
      console.log('[PiP] → HLS PiP activated ✓')
      return
    }

    if (!android) {
      const nativeSuccess = await this.startCanvasPip()
      if (nativeSuccess) {
        console.log('[PiP] → Canvas PiP activated ✓')
        return
      }
    }

    console.log('[PiP] → Popup fallback')
    this.pipMode = 'popup'
    await this.startPopupPip()
  }

  // ============================================
  // MODE 1: HLS Video PiP (ลอยเหนือแอปจริง ทุก platform)
  // HLS URL มาจาก WebSocket data (VPS ส่งมา) ไม่ต้อง hardcode
  // iOS Safari รองรับ HLS natively video PiP ลอยได้
  // Android Chrome video PiP ลอยได้
  // Desktop video PiP ลอยได้
  // ============================================

  // Pre-load HLS video ทันทีที่ได้ URL จาก WebSocket
  // Push ข้อมูลจริงจาก WebSocket ไปให้ VPS render เป็น HLS frame
  // แก้ปัญหา: VPS HLS streamer ไม่ได้รับ MT5 bridge data โดยตรง
  private pushDataToHlsServer(data: RealtimeData): void {
    if (!this.hlsUrl) return
    // Rate-limit: push ไม่เกิน 1 ครั้ง/5 วิ
    const now = Date.now()
    if (now - this.hlsPushLastTime < 5000) return
    this.hlsPushLastTime = now

    const baseUrl = this.hlsUrl.replace(/\/stream\/.*/, '')
    const symCount = Object.keys(data.symbols ?? {}).length
    const staleStr = data.stale ? ' stale' : ' live'
    this.plog(`hls/push → ${baseUrl.slice(-30)} sym=${symCount}${staleStr} cd=${this.globalCountdown}`)

    const payload = {
      timestamp: new Date().toISOString(),
      countdown: this.globalCountdown,
      symbols: data.symbols,
      mode: 'frontend_push',
      stale: !!data.stale,
    }

    fetch(`${baseUrl}/hls/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      this.hlsPushCount++
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        const src = json.src ?? 'ok'
        this.hlsPushStatus = `${src}#${this.hlsPushCount} sym=${json.symbols ?? '?'}`
        // Capture server-side rendering info from enhanced response
        this.hlsServerSrc = json.hls_rendering ?? '?'
        this.hlsServerMode = json.hls_mode ?? '?'
        this.hlsBridgeAge = json.bridge_age_s ?? -1
        this.hlsBridgeConnected = json.bridge_connected ?? false
        this.hlsServerCountdown = json.countdown ?? 0
        if (json.candle_counts) this.hlsCandleCounts = json.candle_counts
        this.plog(`hls/push ✓ ${this.hlsPushStatus} render:${this.hlsServerSrc}`)
      } else {
        this.hlsPushStatus = `fail:${res.status}#${this.hlsPushCount}`
        this.plog(`hls/push ✗ ${res.status} ${res.statusText}`)
      }
    }).catch((err) => {
      this.hlsPushCount++
      this.hlsPushStatus = `err:${err?.message ?? err}#${this.hlsPushCount}`
      this.plog(`hls/push err ${err?.message ?? err}`)
    })
  }

  // เพื่อให้ตอนกด PiP ไม่ต้องรอ fetch/canplay iOS gesture token ไม่หมดอายุ
  private preloadHlsVideo(): void {
    this.cleanupHlsVideo()
    this.hlsReady = false

    const hlsUrl = this.hlsUrl
    if (!hlsUrl) return

    this.plog(`preloading HLS: ${hlsUrl.slice(-40)}`)

    this.hlsVideo = document.createElement('video')
    this.hlsVideo.muted = true
    this.hlsVideo.playsInline = true
    this.hlsVideo.autoplay = false
    this.hlsVideo.controls = false
    this.hlsVideo.preload = 'auto'
    this.hlsVideo.disablePictureInPicture = false
    this.hlsVideo.disableRemotePlayback = true
    this.hlsVideo.setAttribute('playsinline', '')
    this.hlsVideo.setAttribute('webkit-playsinline', '')
    this.hlsVideo.setAttribute('data-pip-manager', 'hls')
    this.hlsVideo.setAttribute('controlsList', 'nofullscreen nodownload noremoteplayback noplaybackrate')
    this.hlsVideo.setAttribute('x-webkit-airplay', 'deny')
    this.hlsVideo.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;'
    document.body.appendChild(this.hlsVideo)

    this.attachHlsDebugListeners(this.hlsVideo)
    this.attachHlsPipExitListeners(this.hlsVideo)

    this.hlsLoadWithRetry(hlsUrl)
  }

  // Debug event listeners — แยกเป็น method เพื่อ reuse
  private attachHlsDebugListeners(v: HTMLVideoElement): void {
    v.addEventListener('loadstart',      () => this.plog('ev:loadstart'))
    v.addEventListener('durationchange', () => this.plog(`ev:durationchange dur=${v.duration}`))
    v.addEventListener('loadedmetadata', () => this.plog(`ev:loadedmetadata rs=${v.readyState}`))
    v.addEventListener('loadeddata',     () => this.plog(`ev:loadeddata rs=${v.readyState} buf=${this.fmtBuf(v)}`))
    v.addEventListener('canplay',        () => this.plog(`ev:canplay rs=${v.readyState} buf=${this.fmtBuf(v)}`))
    v.addEventListener('canplaythrough', () => this.plog(`ev:canplaythrough rs=${v.readyState}`))
    v.addEventListener('playing',        () => this.plog(`ev:playing t=${v.currentTime.toFixed(2)}`))
    v.addEventListener('waiting',        () => this.plog(`ev:waiting t=${v.currentTime.toFixed(2)} rs=${v.readyState}`))
    v.addEventListener('stalled',        () => this.plog(`ev:stalled t=${v.currentTime.toFixed(2)} net=${v.networkState}`))
    v.addEventListener('suspend',        () => this.plog(`ev:suspend t=${v.currentTime.toFixed(2)} rs=${v.readyState}`))
    v.addEventListener('abort',          () => this.plog('ev:abort'))
    v.addEventListener('emptied',        () => this.plog('ev:emptied'))
    v.addEventListener('ended',          () => this.plog('ev:ended'))
    v.addEventListener('error',          () => {
      const e = (v as any).error
      this.plog(`ev:error code=${e?.code} msg=${e?.message}`)
    })
    let lastLoggedTime = -1
    v.addEventListener('timeupdate', () => {
      if (Math.abs(v.currentTime - lastLoggedTime) >= 1) {
        lastLoggedTime = v.currentTime
        this.plog(`ev:timeupdate t=${v.currentTime.toFixed(1)}s rs=${v.readyState}`)
      }
    })
  }

  private fmtBuf(v: HTMLVideoElement): string {
    if (v.buffered.length === 0) return '-'
    return `${v.buffered.start(0).toFixed(1)}-${v.buffered.end(v.buffered.length - 1).toFixed(1)}s`
  }

  // PiP exit listeners — ไม่ทำลาย video element แค่ mark ready สำหรับ re-entry
  private attachHlsPipExitListeners(v: HTMLVideoElement): void {
    const onPipExit = () => {
      this.isActive = false
      this.stopMediaSessionKeepalive()
      this.notifyStateListeners(false)

      // Push ข้อมูลล่าสุดก่อน re-preload — ให้ FFmpeg render segments ด้วย real data
      // ป้องกัน next tap โหลด segment ที่ยังมี mock/old data
      const liveData = (window as any).__signalServiceData ?? null
      const pushBeforePreload = () => {
        if (this.hlsUrl) {
          this.hlsPushLastTime = 0  // reset rate-limit
          const d = signalService.getData()
          if (d?.symbols && Object.keys(d.symbols).length > 0) {
            this.pushDataToHlsServer(d)
          }
        }
      }

      // ตรวจว่า video ยังใช้ได้ไหม — ถ้า rs≥2 + ไม่มี error → mark ready ทันที
      if (this.hlsVideo && this.hlsVideo === v && !v.error && v.readyState >= 2) {
        this.hlsReady = true
        this.plog(`PiP exited — video reusable rs=${v.readyState} → hlsReady=true`)
        pushBeforePreload()
      } else {
        this.plog(`PiP exited — video broken (rs=${v.readyState} err=${v.error?.code}) → re-preloading`)
        pushBeforePreload()
        setTimeout(() => {
          if (this.hlsUrl) this.preloadHlsVideo()
        }, 2000)  // รอ 2s หลัง push ก่อน preload
      }
    }
    v.addEventListener('leavepictureinpicture', onPipExit)
    v.addEventListener('webkitpresentationmodechanged', () => {
      const mode = (v as any)?.webkitPresentationMode
      this.plog(`ev:webkitpresentationmodechanged → ${mode}`)
      if (mode === 'inline') onPipExit()
    })
  }

  private hlsLoadWithRetry(expectedUrl: string, attempt = 0): void {
    this.hlsRetryTimeoutId = null
    if (this.hlsUrl !== expectedUrl || this.hlsReady) {
      this.hlsLoading = false
      return
    }
    if (!this.hlsVideo) return

    // Generation counter — ป้องกัน stale closure จาก load ก่อนหน้า
    this.hlsLoadGeneration++
    const gen = this.hlsLoadGeneration

    this.hlsLoading = true
    const v = this.hlsVideo
    this.plog(`HLS load attempt ${attempt + 1} gen=${gen}`)

    const isStale = () => gen !== this.hlsLoadGeneration || this.hlsUrl !== expectedUrl || this.hlsReady

    // Stall timeout — iOS fires 'stalled' at t=0 then stops trying
    // canplay/loadeddata/error never fire → we're stuck forever
    // Solution: if loadeddata doesn't arrive within 12s → force retry with fresh URL
    let loadedDataArrivedId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      loadedDataArrivedId = null
      if (isStale()) return
      const currentRs = v.readyState
      this.plog(`stall-timeout 12s rs=${currentRs} buf=${this.fmtBuf(v)} → retry fresh URL`)
      cleanup()
      this.hlsLoading = false
      v.removeAttribute('src')
      v.load()
      const sep = expectedUrl.includes('?') ? '&' : '?'
      this.hlsRetryTimeoutId = setTimeout(() => {
        if (!isStale() && this.hlsVideo) {
          this.hlsVideo.src = `${expectedUrl}${sep}_t=${Date.now()}`
          this.hlsLoadWithRetry(expectedUrl, attempt + 1)
        }
      }, 500)
    }, 12000)

    const cleanup = () => {
      v.removeEventListener('canplay', onCanPlay)
      v.removeEventListener('loadeddata', onLoadedData)
      v.removeEventListener('error', onError)
      if (loadedDataArrivedId !== null) {
        clearTimeout(loadedDataArrivedId)
        loadedDataArrivedId = null
      }
      if (this.hlsLoadedDataTimeoutId) {
        clearTimeout(this.hlsLoadedDataTimeoutId)
        this.hlsLoadedDataTimeoutId = null
      }
    }

    const setReady = (event: string) => {
      if (isStale()) { cleanup(); return }
      cleanup()
      this.hlsReady = true
      this.hlsLoading = false
      this.plog(`HLS ready via ${event} (attempt=${attempt + 1} rs=${v.readyState} buf=${this.fmtBuf(v)})`)
    }

    const onCanPlay = () => setReady('canplay')

    const onLoadedData = () => {
      if (isStale()) { cleanup(); return }

      // iOS live HLS: canplay (rs≥3) มักไม่ fire สำหรับ live stream
      // rs=2 (HAVE_CURRENT_DATA) = มี frame แรกแล้ว → เพียงพอสำหรับ PiP entry
      // ถ้า canplay มาใน 3s ก็ใช้ canplay (ดีกว่า)
      // ถ้า 3s ผ่านแล้ว canplay ไม่มา → accept rs=2 เป็น ready
      this.plog(`loadeddata rs=${v.readyState} buf=${this.fmtBuf(v)} — wait canplay 3s or accept rs=2`)
      // Cancel the stall-timeout since loadeddata arrived
      if (loadedDataArrivedId !== null) {
        clearTimeout(loadedDataArrivedId)
        loadedDataArrivedId = null
      }
      this.hlsLoadedDataTimeoutId = setTimeout(() => {
        this.hlsLoadedDataTimeoutId = null
        if (isStale()) return
        if (v.readyState >= 2) {
          // Accept rs=2 — iOS live HLS มักไม่ไปถึง rs=3
          setReady(`loadeddata-accept(rs=${v.readyState})`)
        } else {
          // rs dropped below 2 → retry with fresh URL
          this.plog(`rs dropped to ${v.readyState} → retry with fresh URL`)
          cleanup()
          this.hlsLoading = false
          v.removeAttribute('src')
          v.load()
          const sep = expectedUrl.includes('?') ? '&' : '?'
          this.hlsRetryTimeoutId = setTimeout(() => {
            if (!isStale() && this.hlsVideo) {
              this.hlsVideo.src = `${expectedUrl}${sep}_t=${Date.now()}`
              this.hlsLoadWithRetry(expectedUrl, attempt + 1)
            }
          }, 500)
        }
      }, 3000)
    }

    const onError = () => {
      cleanup()
      if (isStale()) { this.hlsLoading = false; return }
      const code = (v as any).error?.code ?? '?'
      const delay = attempt < 8 ? 2000 : 10000
      this.plog(`HLS error code=${code} → retry in ${delay / 1000}s (gen=${gen})`)
      v.removeAttribute('src')
      v.load()
      this.hlsRetryTimeoutId = setTimeout(() => {
        if (!isStale() && this.hlsVideo) {
          const sep = expectedUrl.includes('?') ? '&' : '?'
          this.hlsVideo.src = `${expectedUrl}${sep}_t=${Date.now()}`
          this.hlsLoadWithRetry(expectedUrl, attempt + 1)
        }
      }, delay)
    }

    v.addEventListener('canplay', onCanPlay, { once: true })
    v.addEventListener('loadeddata', onLoadedData, { once: true })
    v.addEventListener('error', onError, { once: true })

    // Set src — always cache-bust
    if (!v.src || v.src === window.location.href) {
      const sep = expectedUrl.includes('?') ? '&' : '?'
      v.src = `${expectedUrl}${sep}_t=${Date.now()}`
    }
  }

  // ซ่อนปุ่มควบคุม PiP — ให้เหลือแค่ดูอย่างเดียว (Sigzy-style)
  private setupViewOnlyMediaSession(): void {
    if (!('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'TechTrade Signal',
        artist: 'Live Trading',
        // ไม่ใส่ artwork ลด UI clutter ใน PiP
      })

      // บอก browser ว่ากำลังเล่นอยู่ ไม่แสดง play button
      navigator.mediaSession.playbackState = 'playing'

      // iOS: ต้อง set handler เป็น function เปล่า (ไม่ใช่ null)
      // null = ใช้ default ปุ่มยังแสดง
      // () => {} = override เป็นไม่ทำอะไร ปุ่มหาย
      const noop = () => {}
      const allActions: MediaSessionAction[] = [
        'seekbackward', 'seekforward',
        'previoustrack', 'nexttrack', 'skipad',
        'seekto', 'stop',
      ]
      for (const action of allActions) {
        try {
          navigator.mediaSession.setActionHandler(action, noop)
        } catch {
          // บาง action อาจไม่รองรับ
        }
      }

      // play/pause — กด pause แล้วเล่นต่อทันที + รักษา playbackState
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          this.hlsVideo?.play().catch(() => {})
          navigator.mediaSession.playbackState = 'playing'
        })
        navigator.mediaSession.setActionHandler('pause', () => {
          // ไม่ pause จริง — resume ทันที
          navigator.mediaSession.playbackState = 'playing'
          setTimeout(() => {
            this.hlsVideo?.play().catch(() => {})
          }, 50)
        })
      } catch {}

    } catch {
      // Media session not supported
    }
  }

  private async startHlsPip(): Promise<boolean> {
    if (!this.hlsUrl || !this.hlsVideo) {
      this.plog('HLS skip: no URL or video element')
      return false
    }

    const v = this.hlsVideo

    // iOS gesture requirement: webkitSetPresentationMode ต้องถูก call
    // ทันทีหลัง user tap — ห้าม await นาน ไม่งั้น gesture window หมดอายุ
    if (!this.hlsReady) {
      // Fallback: ถ้า video มี rs≥2 แม้ hlsReady ไม่ได้ set (เช่น race condition)
      // ลองเข้า PiP เลย — ดีกว่าตก popup
      if (v.readyState >= 2 && !v.error) {
        this.plog(`HLS not "ready" but rs=${v.readyState} — forcing PiP attempt`)
        this.hlsReady = true
      } else {
        this.plog(`HLS not ready rs=${v.readyState} loading=${this.hlsLoading} — wait next tap`)
        if (!this.hlsLoading) {
          this.hlsLoadWithRetry(this.hlsUrl)
        }
        return false
      }
    }

    try {
      this.plog(`startHlsPip rs=${v.readyState} buf=${this.fmtBuf(v)}`)
      this.setupViewOnlyMediaSession()

      this.plog('play()...')
      const playPromise = v.play()

      if ((v as any).webkitSupportsPresentationMode) {
        // iOS: synchronous call — gesture window ยังอยู่
        this.plog('webkitSetPresentationMode pip')
        ;(v as any).webkitSetPresentationMode('picture-in-picture')
        await playPromise.catch((err: any) => {
          this.plog(`play() rejected: ${err?.name} — retry in 1s`)
          setTimeout(() => {
            if (this.isActive && this.hlsVideo) {
              this.hlsVideo.play().catch(() => {})
            }
          }, 1000)
        })
      } else if ('requestPictureInPicture' in v) {
        await playPromise
        await (v as any).requestPictureInPicture()
      } else {
        throw new Error('PiP API not available')
      }

      this.pipMode = 'hls'
      this.isActive = true
      this.notifyStateListeners(true)
      this.plog('PiP active ✓')

      // เรียกอีกรอบหลัง PiP เริ่ม — เผื่อ browser reset handlers
      this.setupViewOnlyMediaSession()

      // Keepalive: stall recovery + mediaSession refresh ทุก 2 วิ
      this.stopMediaSessionKeepalive()
      let lastCurrentTime = -1
      let stuckTicks = 0
      this.mediaSessionIntervalId = setInterval(() => {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing'
        }
        const v = this.hlsVideo
        if (!v || !this.isActive) return

        // Resume if paused by system
        if (v.paused) {
          this.plog('keepalive: resume paused')
          v.play().catch(() => {})
          stuckTicks = 0
          lastCurrentTime = -1
          return
        }

        // Stall detection: currentTime not advancing + no future data
        const timeStuck = v.readyState < 3 && v.currentTime === lastCurrentTime && lastCurrentTime >= 0
        if (timeStuck) {
          stuckTicks++

          if (stuckTicks === 3) {
            // 6s stall — try play()
            this.plog(`stall 6s t=${v.currentTime.toFixed(1)}s rs=${v.readyState} → play()`)
            v.play().catch(() => {})

          } else if (stuckTicks === 8) {
            // 16s stall — pause + resume (soft reset ไม่ทำลาย PiP state)
            // ห้ามใช้ v.load() ตอน PiP active — จะทำให้ AbortError + iOS เตะออกจาก PiP
            this.plog(`stall 16s → pause+play`)
            v.pause()
            setTimeout(() => {
              if (this.isActive && v === this.hlsVideo) {
                v.play().catch(() => {})
              }
            }, 300)

          } else if (stuckTicks === 15) {
            // 30s stall — ออก PiP อัตโนมัติ + re-preload พร้อม real data
            // ไม่ force re-enter PiP (ต้องเป็น gesture จาก user เท่านั้น)
            this.plog(`stall 30s → auto-exit PiP, re-preload`)
            stuckTicks = 0
            this.stopMediaSessionKeepalive()
            // Exit PiP gracefully
            try { ;(v as any).webkitSetPresentationMode?.('inline') } catch {}
            // Push + re-preload สำหรับ next tap
            this.hlsPushLastTime = 0
            const d = signalService.getData()
            if (d?.symbols) this.pushDataToHlsServer(d)
            setTimeout(() => {
              if (this.hlsUrl && !this.isActive) this.preloadHlsVideo()
            }, 2000)
            return
          }
        } else {
          if (stuckTicks > 0) this.plog(`stall cleared t=${v.currentTime.toFixed(1)}s`)
          stuckTicks = 0
        }
        lastCurrentTime = v.currentTime
      }, 2000)

      return true

    } catch (err: any) {
      this.plog(`startHlsPip err: ${err?.message ?? err}`)
      // Only abandon if PiP was never set
      if (!this.isActive) {
        try { this.hlsVideo?.pause() } catch {}
        return false
      }
      return true
    }
  }

  private stopMediaSessionKeepalive(): void {
    if (this.mediaSessionIntervalId) {
      clearInterval(this.mediaSessionIntervalId)
      this.mediaSessionIntervalId = null
    }
  }

  private cleanupHlsVideo(): void {
    this.hlsLoading = false
    this.hlsReady = false
    this.hlsLoadGeneration++ // invalidate all in-flight closures
    if (this.hlsRetryTimeoutId) {
      clearTimeout(this.hlsRetryTimeoutId)
      this.hlsRetryTimeoutId = null
    }
    if (this.hlsLoadedDataTimeoutId) {
      clearTimeout(this.hlsLoadedDataTimeoutId)
      this.hlsLoadedDataTimeoutId = null
    }
    if (this.hlsVideo) {
      this.hlsVideo.pause()
      this.hlsVideo.removeAttribute('src')
      this.hlsVideo.load()
      if (this.hlsVideo.parentNode) {
        this.hlsVideo.parentNode.removeChild(this.hlsVideo)
      }
      this.hlsVideo = null
    }
  }

  // ============================================
  // MODE 2: Canvas captureStream PiP (Desktop Chrome/Edge)
  // ============================================

  private async startCanvasPip(): Promise<boolean> {
    if (!this.video || !this.canvas) return false

    // เช็คว่า browser รองรับ PiP API
    const hasNativePip = 'pictureInPictureEnabled' in document &&
                         (document as any).pictureInPictureEnabled
    const hasWebkitPip = 'webkitSupportsPresentationMode' in HTMLVideoElement.prototype
    if (!hasNativePip && !hasWebkitPip) return false

    try {
      this.drawPipCanvas()
      this.stream = (this.canvas as any).captureStream(PIP_FPS)

      // Silent audio track — ช่วยให้ PiP ทำงานได้ดีขึ้น
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioCtx.createOscillator()
        const gainNode = audioCtx.createGain()
        gainNode.gain.value = 0
        oscillator.connect(gainNode)
        const dest = audioCtx.createMediaStreamDestination()
        gainNode.connect(dest)
        oscillator.start()

        const audioTrack = dest.stream.getAudioTracks()[0]
        if (audioTrack && this.stream) {
          this.stream.addTrack(audioTrack)
        }
      } catch {
        // ไม่ต้อง audio ก็ได้
      }

      this.video.srcObject = this.stream
      await this.video.play()

      // ลอง standard PiP API
      if ('requestPictureInPicture' in this.video) {
        await (this.video as any).requestPictureInPicture()
      } else if ((this.video as any).webkitSupportsPresentationMode) {
        (this.video as any).webkitSetPresentationMode('picture-in-picture')
      }

      this.pipMode = 'native'
      this.startRenderLoop()
      // Canvas PiP activated
      return true

    } catch (error) {
      // Canvas PiP failed
      this.cleanupStream()
      return false
    }
  }

  // ============================================
  // MODE 2: Overlay (มือถือ iOS/Android)
  // ใช้ fixed overlay แทน popup — ทำงานได้ทุก browser
  // ============================================

  private overlayContainer: HTMLDivElement | null = null
  private overlayW = 0
  private overlayH = 0

  private async startPopupPip(): Promise<void> {
    try {
      // ลบ overlay เก่าถ้ามี (ป้องกันซ้อน 2 อัน)
      const existing = document.getElementById('pip-overlay')
      if (existing) existing.remove()

      const mobile = this.isMobile()

      // Mobile: กว้างประมาณ 90% จอ สูง auto ตาม ratio 3:2 grid
      // ลากได้ทุก device — ให้ user วางมุมที่ต้องการ
      const vw = window.innerWidth
      const overlayW = mobile ? Math.min(Math.round(vw * 0.88), 360) : 280
      // grid 3×2 → ratio height = (width/3) * 2 * (9/16) + header
      const cellH = Math.round((overlayW / 3) * 0.62)
      const overlayH = mobile ? cellH * 2 + 26 : 200 // 26 = slim header strip

      // สร้าง overlay container
      this.overlayContainer = document.createElement('div')
      this.overlayContainer.id = 'pip-overlay'
      this.overlayContainer.setAttribute('data-pip-manager', 'overlay')
      this.overlayContainer.style.cssText = `
        position: fixed;
        bottom: ${mobile ? '72px' : '80px'};
        right: 8px;
        width: ${overlayW}px;
        height: ${overlayH}px;
        z-index: 99999;
        border-radius: ${mobile ? '10px' : '12px'};
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.65);
        border: 1.5px solid rgba(0,228,118,0.35);
        touch-action: none;
      `

      // ปุ่มปิด — วางไว้มุม overlay ไม่บังกราฟมาก
      const closeBtn = document.createElement('button')
      closeBtn.style.cssText = `
        position: absolute;
        top: 3px;
        right: 3px;
        z-index: 100000;
        width: ${mobile ? '22px' : '20px'};
        height: ${mobile ? '22px' : '20px'};
        border-radius: 50%;
        background: rgba(0,0,0,0.8);
        color: rgba(255,255,255,0.8);
        border: none;
        font-size: ${mobile ? '12px' : '11px'};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        line-height: 1;
        padding: 0;
      `
      closeBtn.textContent = '✕'
      closeBtn.addEventListener('click', (e) => { e.stopPropagation(); this.stop() })

      // เก็บ dimensions — ใช้อ้างอิงใน drawPipCanvas ทุก frame โดยไม่ query DOM
      this.overlayW = overlayW
      this.overlayH = overlayH

      // สร้าง canvas — set size ครั้งเดียว (CSS pixel) ไม่ resize ทุก frame
      // CSS width/height 100% จะ scale visual ให้พอดี overlay container
      this.popupCanvas = document.createElement('canvas')
      this.popupCanvas.width = overlayW
      this.popupCanvas.height = overlayH
      this.popupCanvas.style.cssText = 'width: 100%; height: 100%; display: block; image-rendering: pixelated;'
      this.popupCtx = this.popupCanvas.getContext('2d', { alpha: false })

      this.overlayContainer.appendChild(this.popupCanvas)
      this.overlayContainer.appendChild(closeBtn)
      document.body.appendChild(this.overlayContainer)

      // ลากได้ทุก device
      this.setupDrag(this.overlayContainer)

      this.isActive = true
      this.notifyStateListeners(true)
      this.startRenderLoop()

    } catch (error) {
      // Overlay PiP failed
      this.isActive = false
    }
  }

  private setupDrag(el: HTMLDivElement): void {
    let startX = 0, startY = 0, origX = 0, origY = 0, dragging = false

    const onStart = (clientX: number, clientY: number) => {
      dragging = true
      startX = clientX
      startY = clientY
      const rect = el.getBoundingClientRect()
      origX = rect.left
      origY = rect.top
      el.style.transition = 'none'
    }

    const onMove = (clientX: number, clientY: number) => {
      if (!dragging) return
      const dx = clientX - startX
      const dy = clientY - startY
      el.style.left = `${origX + dx}px`
      el.style.top = `${origY + dy}px`
      el.style.right = 'auto'
      el.style.bottom = 'auto'
    }

    const onEnd = () => {
      dragging = false
      el.style.transition = 'transform 0.2s ease'
    }

    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0]
      onStart(t.clientX, t.clientY)
    }, { passive: true })

    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0]
      onMove(t.clientX, t.clientY)
      e.preventDefault()
    }, { passive: false })

    el.addEventListener('touchend', onEnd)

    el.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY))
    document.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY))
    document.addEventListener('mouseup', onEnd)
  }

  async stop(): Promise<void> {
    try {
      // ปิด native PiP
      if ((document as any).pictureInPictureElement) {
        await (document as any).exitPictureInPicture()
      }

      // ปิด webkit PiP (Safari)
      if (this.video && (this.video as any).webkitPresentationMode === 'picture-in-picture') {
        (this.video as any).webkitSetPresentationMode('inline')
      }

      // ปิด HLS video
      this.cleanupHlsVideo()
      this.stopMediaSessionKeepalive()

      // ปิด overlay
      if (this.overlayContainer && this.overlayContainer.parentNode) {
        this.overlayContainer.parentNode.removeChild(this.overlayContainer)
      }
      this.overlayContainer = null
      this.overlayW = 0
      this.overlayH = 0

      this.popupCanvas = null
      this.popupCtx = null

      this.isActive = false
      this.stopRenderLoop()
      this.cleanupStream()
      this.notifyStateListeners(false)
    } catch (error) {
      // Failed to stop PiP
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
    // อ่านข้อมูลล่าสุดจาก signalService โดยตรงทุก frame
    // ไม่พึ่ง subscription เพื่อหลีกเลี่ยงปัญหา timing / module instance
    const liveData = signalService.getData()
    if (liveData) {
      if (liveData.symbols) {
        this.symbolData = liveData.symbols
      }
      if (liveData.countdown !== undefined) {
        this.globalCountdown = liveData.stale ? 0 : liveData.countdown
      } else if (liveData.symbols) {
        for (const sym of Object.values(liveData.symbols)) {
          if (sym.countdown !== undefined) {
            this.globalCountdown = liveData.stale ? 0 : sym.countdown
            break
          }
        }
      }
    }

    // วาดลง canvas หลัก (native PiP) หรือ popup canvas
    const ctx = this.pipMode === 'popup' && this.popupCtx
      ? this.popupCtx
      : this.ctx

    if (!ctx) return

    // ใช้ dimensions ที่เก็บไว้ตอนสร้าง — ไม่ query DOM ทุก frame
    // canvas size ถูก set ครั้งเดียวตอน startPopupPip() แล้ว
    const width = this.pipMode === 'popup'
      ? (this.overlayW || PIP_WIDTH)
      : this.canvas?.width || PIP_WIDTH
    const height = this.pipMode === 'popup'
      ? (this.overlayH || PIP_HEIGHT)
      : this.canvas?.height || PIP_HEIGHT

    // Clear canvas
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // Mobile overlay → slim mode: ตัด price axis/line ออก, header เล็กลง
    const slim = this.pipMode === 'popup' && this.isMobile()

    if (slim) {
      // Mini header: แค่ title + global timer — สูง 26px แทน 40px
      ctx.fillStyle = COLORS.header
      ctx.fillRect(0, 0, width, 26)
      ctx.fillStyle = '#FFFFFF'
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText('TechTrade Signal', 6, 18)
      ctx.textAlign = 'right'
      ctx.font = 'bold 13px monospace'
      ctx.fillStyle = this.globalCountdown <= 10 ? COLORS.down : '#AAAAAA'
      ctx.fillText(this.formatTime(this.globalCountdown), width - 28, 18) // เว้นที่ปุ่มปิด
    } else {
      this.drawHeader(ctx, width)
    }

    // Draw 6 charts in 3x2 grid
    const chartWidth = width / 3
    const headerHeight = slim ? 26 : 40
    const chartHeight = (height - headerHeight) / 2

    SYMBOLS.forEach((symbol, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
      const x = col * chartWidth
      const y = headerHeight + row * chartHeight

      this.drawChart(ctx, symbol, x, y, chartWidth, chartHeight, index, slim)
    })
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  private isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768
  }

  private isIOS(): boolean {
    if (typeof navigator === 'undefined') return false
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  private isAndroid(): boolean {
    if (typeof navigator === 'undefined') return false
    return /Android/.test(navigator.userAgent)
  }

  private drawHeader(ctx: CanvasRenderingContext2D, width: number): void {
    // Header background
    ctx.fillStyle = COLORS.header
    ctx.fillRect(0, 0, width, 40)

    // Title
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('TechTrade Signal', 10, 26)

    // Countdown — MM:SS format same as web
    ctx.textAlign = 'right'
    ctx.font = 'bold 20px monospace'
    ctx.fillStyle = this.globalCountdown <= 10 ? COLORS.down : '#FFFFFF'
    ctx.fillText(this.formatTime(this.globalCountdown), width - 10, 28)
  }

  private drawChart(
    ctx: CanvasRenderingContext2D,
    symbol: string,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number,
    index: number,
    slim = false
  ): void {
    const data = this.symbolData[symbol]
    const config = this.symbolConfigs[symbol]
    const displayName = DISPLAY_NAMES[index]
    const countdown = (this.symbolData[symbol] as any)?.countdown ?? this.globalCountdown

    // ── Per-chart header bar ──
    const chartHeaderH = slim ? 28 : 20

    ctx.fillStyle = COLORS.header
    ctx.fillRect(offsetX, offsetY, width, chartHeaderH)

    // Pair name — top left, larger on slim/mobile
    ctx.fillStyle = slim ? '#00E676' : '#FFFFFF'
    ctx.font = slim ? 'bold 15px sans-serif' : 'bold 11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(displayName, offsetX + 5, offsetY + (slim ? 20 : 14))

    if (slim) {
      // Timer — top right of each chart (MM:SS format)
      ctx.fillStyle = countdown <= 10 ? COLORS.down : '#AAAAAA'
      ctx.font = 'bold 13px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(this.formatTime(countdown), offsetX + width - 5, offsetY + 20)
    } else {
      // Active signal indicator (desktop)
      if (config?.enabled === false) {
        ctx.fillStyle = COLORS.down
        ctx.fillText('●', offsetX + width - 20, offsetY + 14)
      }
      if (data?.active_signal) {
        const isCall = data.active_signal.signal === 1 || data.active_signal.signal_type === 'CALL'
        ctx.fillStyle = isCall ? COLORS.callArrow : COLORS.putArrow
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'right'
        ctx.fillText(isCall ? '▲' : '▼', offsetX + width - 8, offsetY + 14)
      }
    }

    // Adjust for header
    offsetY += chartHeaderH
    height -= chartHeaderH

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

    // slim = no price axis → full width for candles
    const margin = slim
      ? { top: 4, bottom: 4, left: 4, right: 4 }
      : { top: 5, bottom: 5, left: 5, right: 50 }

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

    if (!slim) {
      // Y-axis labels + grid lines (desktop only)
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
    }

    // Draw candles
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      const x = indexToX(i)
      const isUp = c.close >= c.open
      const color = isUp ? COLORS.up : COLORS.down

      ctx.strokeStyle = color
      ctx.lineWidth = slim ? 1.5 : 1
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

    if (!slim) {
      // Current price line + label (desktop only)
      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1]
        const decimals = symbol.includes('JPY') ? 3 : 5
        const currentY = priceToY(lastCandle.close)

        ctx.strokeStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(offsetX + margin.left, currentY)
        ctx.lineTo(offsetX + width - margin.right, currentY)
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = lastCandle.close >= lastCandle.open ? COLORS.up : COLORS.down
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'left'
        ctx.fillText(`${lastCandle.close.toFixed(decimals)}`, offsetX + width - margin.right + 2, currentY - 5)
      }
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

  getPipMode(): PipMode {
    return this.pipMode
  }

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

    this.cleanupHlsVideo()

    if (this.overlayContainer && this.overlayContainer.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer)
    }

    // Cleanup debug overlay
    if (this.debugRefreshId) {
      clearInterval(this.debugRefreshId)
      this.debugRefreshId = null
    }
    if (this.hlsDebugFetchId) {
      clearInterval(this.hlsDebugFetchId)
      this.hlsDebugFetchId = null
    }
    if (this.debugOverlay && this.debugOverlay.parentNode) {
      this.debugOverlay.parentNode.removeChild(this.debugOverlay)
      this.debugOverlay = null
    }

    this.canvas = null
    this.video = null
    this.ctx = null
    this.overlayContainer = null
    this.popupCanvas = null
    this.popupCtx = null
  }
}

// Export singleton instance
export const pipManager = PipManager.getInstance()