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
  private lastError: string | null = null // เก็บ error ล่าสุดสำหรับ debug

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
    // รองรับทุก platform — จะลอง HLS → Canvas PiP → Overlay ตอน start()
    this.pipMode = 'hls'
    this.isSupported = true

    // Cleanup any existing PiP elements (from hot reload or previous instances)
    document.querySelectorAll('[data-pip-manager]').forEach(el => el.remove())

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

    // เมื่อ user ปัดออกจากหน้าเว็บ → auto PiP
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.isActive && this.video) {
        // PiP จะทำงานต่อเมื่อ user ออกจาก browser
      }
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
      if (data.hls_url && data.hls_url !== this.hlsUrl) {
        this.hlsUrl = data.hls_url
        this.preloadHlsVideo()
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
    if (this.isActive) return

    console.log('[PiP] Starting fallback chain: HLS → Canvas → Overlay')

    // ลองตามลำดับ: HLS → Canvas PiP → Overlay
    const hlsSuccess = await this.startHlsPip()
    if (hlsSuccess) return

    // Canvas captureStream PiP (Desktop Chrome/Edge)
    console.log('[PiP] Trying Canvas PiP...')
    const nativeSuccess = await this.startCanvasPip()
    if (nativeSuccess) return

    // Overlay fallback (ลอยในเว็บเท่านั้น)
    console.log('[PiP] Falling back to Overlay (in-web only)')
    this.pipMode = 'popup'
    await this.startPopupPip()
  }

  // ============================================
  // MODE 1: HLS Video PiP (ลอยเหนือแอปจริง ทุก platform)
  // HLS URL มาจาก WebSocket data (VPS ส่งมา) ไม่ต้อง hardcode
  // iOS Safari รองรับ HLS natively → video PiP ลอยได้
  // Android Chrome → video PiP ลอยได้
  // Desktop → video PiP ลอยได้
  // ============================================

  // Pre-load HLS video ทันทีที่ได้ URL จาก WebSocket
  // เพื่อให้ตอนกด PiP ไม่ต้องรอ fetch/canplay → iOS gesture token ไม่หมดอายุ
  private preloadHlsVideo(): void {
    // Cleanup old one if URL changed
    this.cleanupHlsVideo()
    this.hlsReady = false

    const hlsUrl = this.hlsUrl
    if (!hlsUrl) return

    console.log('[PiP] Pre-loading HLS video:', hlsUrl)

    this.hlsVideo = document.createElement('video')
    this.hlsVideo.src = hlsUrl
    this.hlsVideo.muted = true
    this.hlsVideo.playsInline = true
    this.hlsVideo.autoplay = true // iOS ต้อง autoplay muted เพื่อ warm up video element
    this.hlsVideo.controls = false
    this.hlsVideo.preload = 'auto'
    this.hlsVideo.disablePictureInPicture = false
    // ไม่ set crossOrigin — Cloudflare tunnel อาจไม่ส่ง CORS header
    // ถ้า set แล้ว browser จะ block load เลย
    this.hlsVideo.setAttribute('playsinline', '')
    this.hlsVideo.setAttribute('webkit-playsinline', '')
    this.hlsVideo.setAttribute('autopictureinpicture', '')
    this.hlsVideo.setAttribute('data-pip-manager', 'hls')
    this.hlsVideo.disableRemotePlayback = true // ซ่อนปุ่ม AirPlay/Cast
    // iOS ต้อง "เห็น" video จึงจะอนุญาต PiP — ซ่อนแต่มีขนาดจริง
    this.hlsVideo.style.cssText = 'position:fixed;bottom:0;left:0;width:10px;height:10px;opacity:0.01;pointer-events:none;z-index:-1;'
    document.body.appendChild(this.hlsVideo)

    // ซ่อนปุ่มควบคุมใน PiP window — ลบ action handlers ทั้งหมด
    this.setupViewOnlyMediaSession()

    // Listen for PiP exit events
    this.hlsVideo.addEventListener('leavepictureinpicture', () => {
      this.isActive = false
      this.notifyStateListeners(false)
    })
    this.hlsVideo.addEventListener('webkitpresentationmodechanged', () => {
      const mode = (this.hlsVideo as any)?.webkitPresentationMode
      if (mode === 'inline') {
        this.isActive = false
        this.notifyStateListeners(false)
      }
    })

    this.hlsVideo.addEventListener('canplay', () => {
      this.hlsReady = true
      console.log('[PiP] ✅ HLS video pre-loaded and ready for PiP', {
        readyState: this.hlsVideo?.readyState,
        duration: this.hlsVideo?.duration,
        videoWidth: this.hlsVideo?.videoWidth,
      })
    }, { once: true })

    this.hlsVideo.addEventListener('loadedmetadata', () => {
      console.log('[PiP] HLS metadata loaded', {
        duration: this.hlsVideo?.duration,
        videoWidth: this.hlsVideo?.videoWidth,
        videoHeight: this.hlsVideo?.videoHeight,
      })
    }, { once: true })

    this.hlsVideo.addEventListener('error', () => {
      const err = this.hlsVideo?.error
      console.log('[PiP] ❌ HLS video preload failed:', {
        code: err?.code,
        message: err?.message,
        networkState: this.hlsVideo?.networkState,
      })
      this.hlsReady = false
    }, { once: true })

    // เริ่ม load
    this.hlsVideo.load()
  }

  // ซ่อนปุ่มควบคุม PiP — ให้เหลือแค่ดูอย่างเดียว
  private setupViewOnlyMediaSession(): void {
    if (!('mediaSession' in navigator)) return

    try {
      // ตั้งชื่อให้แสดงใน PiP
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'TechTrade Signal',
        artist: 'Live Trading',
      })

      // ลบปุ่มทั้งหมด — set handler เป็น null
      const actions: MediaSessionAction[] = [
        'play', 'pause', 'seekbackward', 'seekforward',
        'previoustrack', 'nexttrack', 'skipad',
      ]
      for (const action of actions) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // บาง action อาจไม่รองรับ
        }
      }

      // play/pause — ไม่ให้หยุดได้ (เล่นต่อเสมอ)
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          this.hlsVideo?.play().catch(() => {})
        })
        navigator.mediaSession.setActionHandler('pause', () => {
          // ไม่ pause — เล่นต่อทันที
          this.hlsVideo?.play().catch(() => {})
        })
      } catch {}

      console.log('[PiP] Media session: view-only mode set')
    } catch (e) {
      console.log('[PiP] Media session setup failed:', e)
    }
  }

  private async startHlsPip(): Promise<boolean> {
    // Diagnostic logging
    console.log('[PiP] startHlsPip check:', {
      hlsUrl: this.hlsUrl,
      hlsVideo: !!this.hlsVideo,
      hlsReady: this.hlsReady,
      readyState: this.hlsVideo?.readyState,
      networkState: this.hlsVideo?.networkState,
    })

    if (!this.hlsUrl || !this.hlsVideo) {
      this.lastError = !this.hlsUrl ? 'No HLS URL from WebSocket (VPS ยังไม่ set HLS_PUBLIC_URL)' : 'No HLS video element'
      console.log('[PiP] HLS skip:', this.lastError)
      return false
    }

    // ถ้า video ยัง load ไม่เสร็จ → ลอง reload + รอสั้นๆ
    if (!this.hlsReady && this.hlsVideo.readyState < 2) {
      console.log('[PiP] HLS video not ready, attempting reload...')
      this.hlsVideo.src = this.hlsUrl
      this.hlsVideo.load()
      // รอ canplay สั้นๆ (max 3 วินาที) — ต้องเร็วไม่งั้น gesture token หมด
      const ready = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 3000)
        this.hlsVideo!.addEventListener('canplay', () => {
          clearTimeout(timeout)
          resolve(true)
        }, { once: true })
        this.hlsVideo!.addEventListener('error', () => {
          clearTimeout(timeout)
          resolve(false)
        }, { once: true })
      })
      if (!ready) {
        this.lastError = 'HLS video ไม่สามารถ load ได้ภายใน 3s (CORS หรือ URL ผิด)'
        console.log('[PiP] HLS skip:', this.lastError)
        return false
      }
    }

    try {
      // ⚡ ต้องเร็วที่สุด — iOS gesture token มีอายุสั้นมาก
      // play() + requestPiP ต้องเกิดทันทีหลัง user tap
      await this.hlsVideo.play()
      console.log('[PiP] HLS play() success')

      // iOS Safari: ลอง webkit ก่อน (รองรับ HLS natively)
      if ((this.hlsVideo as any).webkitSupportsPresentationMode) {
        console.log('[PiP] Using webkit PiP (Safari)')
        ;(this.hlsVideo as any).webkitSetPresentationMode('picture-in-picture')
      } else if ('requestPictureInPicture' in this.hlsVideo) {
        console.log('[PiP] Using standard PiP API')
        await (this.hlsVideo as any).requestPictureInPicture()
      } else {
        throw new Error('PiP API not available on this browser')
      }

      this.pipMode = 'hls'
      this.isActive = true
      this.notifyStateListeners(true)
      console.log('[PiP] ✅ HLS PiP activated — ลอยเหนือแอปอื่นได้')
      return true

    } catch (error: any) {
      this.lastError = `HLS PiP error: ${error?.message || error}`
      console.log('[PiP] HLS PiP failed:', error)
      // Cleanup failed play
      try { this.hlsVideo.pause() } catch {}
      return false
    }
  }

  private cleanupHlsVideo(): void {
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
      console.log('✅ Canvas PiP activated')
      return true

    } catch (error) {
      console.log('Canvas PiP failed:', error)
      this.cleanupStream()
      return false
    }
  }

  // ============================================
  // MODE 2: Overlay (มือถือ iOS/Android)
  // ใช้ fixed overlay แทน popup — ทำงานได้ทุก browser
  // ============================================

  private overlayContainer: HTMLDivElement | null = null

  private async startPopupPip(): Promise<void> {
    try {
      // ลบ overlay เก่าถ้ามี (ป้องกันซ้อน 2 อัน)
      const existing = document.getElementById('pip-overlay')
      if (existing) existing.remove()

      // สร้าง overlay container
      this.overlayContainer = document.createElement('div')
      this.overlayContainer.id = 'pip-overlay'
      this.overlayContainer.setAttribute('data-pip-manager', 'overlay')
      this.overlayContainer.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 8px;
        width: 280px;
        height: 200px;
        z-index: 9999;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        border: 2px solid rgba(0,228,118,0.3);
        touch-action: none;
        transition: transform 0.2s ease;
      `

      // ปุ่มปิด
      const closeBtn = document.createElement('button')
      closeBtn.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        z-index: 10000;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0,0,0,0.7);
        color: white;
        border: none;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      `
      closeBtn.textContent = '✕'
      closeBtn.addEventListener('click', () => this.stop())

      // สร้าง canvas
      this.popupCanvas = document.createElement('canvas')
      this.popupCanvas.width = PIP_WIDTH
      this.popupCanvas.height = PIP_HEIGHT
      this.popupCanvas.style.cssText = 'width: 100%; height: 100%; display: block;'
      this.popupCtx = this.popupCanvas.getContext('2d', { alpha: false })

      this.overlayContainer.appendChild(this.popupCanvas)
      this.overlayContainer.appendChild(closeBtn)
      document.body.appendChild(this.overlayContainer)

      // ลาก overlay ได้ (touch drag)
      this.setupDrag(this.overlayContainer)

      this.isActive = true
      this.notifyStateListeners(true)
      this.startRenderLoop()

    } catch (error) {
      console.error('Overlay PiP failed:', error)
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

      // ปิด overlay
      if (this.overlayContainer && this.overlayContainer.parentNode) {
        this.overlayContainer.parentNode.removeChild(this.overlayContainer)
      }
      this.overlayContainer = null

      this.popupCanvas = null
      this.popupCtx = null

      this.isActive = false
      this.stopRenderLoop()
      this.cleanupStream()
      this.notifyStateListeners(false)
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
    // วาดลง canvas หลัก (native PiP) หรือ popup canvas
    const ctx = this.pipMode === 'popup' && this.popupCtx
      ? this.popupCtx
      : this.ctx

    if (!ctx) return

    // Resize overlay canvas ตามขนาด container
    if (this.pipMode === 'popup' && this.popupCanvas && this.overlayContainer) {
      const w = this.overlayContainer.clientWidth
      const h = this.overlayContainer.clientHeight
      const dpr = window.devicePixelRatio || 1
      if (this.popupCanvas.width !== w * dpr || this.popupCanvas.height !== h * dpr) {
        this.popupCanvas.width = w * dpr
        this.popupCanvas.height = h * dpr
        ctx.scale(dpr, dpr)
      }
    }
    const width = this.pipMode === 'popup' && this.overlayContainer
      ? this.overlayContainer.clientWidth
      : this.canvas?.width || PIP_WIDTH
    const height = this.pipMode === 'popup' && this.overlayContainer
      ? this.overlayContainer.clientHeight
      : this.canvas?.height || PIP_HEIGHT

    // Clear canvas
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, width, height)

    // Draw header
    this.drawHeader(ctx, width)

    // Draw 6 charts in 3x2 grid
    const chartWidth = width / 3
    const chartHeight = (height - 40) / 2
    const headerHeight = 40

    SYMBOLS.forEach((symbol, index) => {
      const col = index % 3
      const row = Math.floor(index / 3)
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

  getDebugInfo(): { hlsUrl: string | null; hlsReady: boolean; pipMode: PipMode; lastError: string | null; hlsVideoState: number | null } {
    return {
      hlsUrl: this.hlsUrl,
      hlsReady: this.hlsReady,
      pipMode: this.pipMode,
      lastError: this.lastError,
      hlsVideoState: this.hlsVideo?.readyState ?? null,
    }
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