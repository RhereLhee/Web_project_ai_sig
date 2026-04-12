# TechTrade - AI Trading Signal Platform

## Tech Stack
- **Frontend**: Next.js 16.1.1 (App Router, TypeScript, Tailwind CSS)
- **Database**: PostgreSQL via Supabase (Free Tier) + Prisma ORM 5.22.0
- **Auth**: JWT (jose) with httpOnly cookies, Access/Refresh tokens
- **Deploy Frontend**: Render Free Tier (standalone mode)
- **Signal Backend**: Python FastAPI + MetaTrader5 on Windows VPS
- **Streaming**: HLS via FFmpeg + Pillow (server-side chart rendering)
- **PWA**: manifest.json + apple-web-app meta (Add to Home Screen)

---

## Repositories

| Repo | URL | Deploy |
|---|---|---|
| **Frontend (Next.js)** | `github.com/RhereLhee/Web_project_ai_sig` | Render auto-deploy → `techtrade-ztdd.onrender.com` |
| **Backend (Python)** | `github.com/RhereLhee/algorithm_trade_Project` | Render auto-deploy → `trading-api-83hs.onrender.com` + VPS manual |

---

## Architecture (Updated 12 เม.ย. 2026)

```
                         ┌─────────────────────────────────────────────────────────┐
                         │  Windows VPS (Windows Server)                           │
                         │  Path: C:\Users\Administrator\PycharmProjects\pythonProject3  │
                         │                                                         │
  MT5 Terminal ────────► │  real_time_monitor.py (Process 1)                       │
  (market data)          │    - อ่าน candle data 6 symbols จาก MT5               │
  (6 symbols)            │    - รัน AI Model V7 predict signal                    │
                         │    - POST /bridge/update ไป Render API (timeout 15s)   │
                         │    - POST /bridge/update ไป localhost:8000 ด้วย        │
                         │    - แนบ hls_url ใน bridge data (ถ้ามี HLS_PUBLIC_URL)  │
                         │                                                         │
                         │  run_api.py (Process 2) → FastAPI :8000                │
                         │    - รับ bridge data จาก monitor                        │
                         │    - WebSocket /ws/signal broadcast ทุก 1 วินาที       │
                         │    - Mount /stream/ สำหรับ HLS files                   │
                         │    - Cloudflare Quick Tunnel (HTTPS)                    │
                         │      URL เปลี่ยนทุกครั้งที่ restart tunnel              │
                         │                                                         │
                         │  hls_streamer.py (Background task ใน run_api.py)       │
                         │    - Pillow render chart 1280x720 HD                   │
                         │    - Centered symbol name, large fonts, no prices      │
                         │    - Single countdown MM:SS at top-right                │
                         │    - FFmpeg pipe → HLS (.m3u8 + .ts segments)           │
                         │    - Output: stream/signal.m3u8                         │
                         └───────────┬─────────────────────────────────────────────┘
                                     │ POST /bridge/update
                                     │ (ทุก ~1 วินาที)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Render Free Tier (Python API)                                                   │
│  URL: https://trading-api-83hs.onrender.com                                     │
│                                                                                  │
│  realtime_api.py (เหมือนกัน deploy จาก repo เดียวกัน)                           │
│    - รับ bridge data จาก VPS                                                    │
│    - Cache _bridge_hls_url จาก bridge data                                      │
│    - WebSocket /ws/signal → broadcast ไป frontend clients                       │
│    - hls_url fallback chain: env > bridge data > cached URL                     │
│    - /debug/hls endpoint สำหรับ debug HLS URL delivery                          │
│    - ถ้าไม่มี bridge data → broadcast mock_data อัตโนมัติ                       │
│    - Auth: ถ้าไม่มี API key ตั้ง → skip auth (ให้ VPS POST ได้เลย)              │
│                                                                                  │
│  IMPORTANT: Render Free Tier sleep หลัง 15 นาที                                 │
│    - cold start ใช้เวลา 30-60 วินาที                                           │
│    - VPS monitor ใช้ timeout 15s เพื่อรอ                                        │
│    - ใช้ UptimeRobot ping ป้องกัน sleep                                         │
└──────────────────────────────────────────────────────────────────────────────────┘
                                     │ WebSocket (wss://)
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Render Free Tier (Next.js Frontend)                                             │
│  URL: https://techtrade-ztdd.onrender.com                                        │
│                                                                                  │
│  signal-service.ts (Singleton)                                                   │
│    - WebSocket connect: NEXT_PUBLIC_WS_URL || wss://trading-api-83hs.../ws/signal│
│    - Reconnect: max 50 attempts, exponential backoff cap 30s                     │
│    - Fallback: HTTP polling /api/trading/realtime                                │
│                                                                                  │
│  PipProvider.tsx (React Context ใน layout.tsx)                                   │
│    - subscribe signal-service data                                               │
│    - ส่ง data ไป pip-manager.ts                                                 │
│    - Sound alert เมื่อมี signal ใหม่                                            │
│    - Countdown จาก MT5 ตรงๆ (ไม่มี local timer)                                │
│                                                                                  │
│  pip-manager.ts (Singleton - PiP Fallback Chain)                                │
│    1. HLS PiP → <video src="m3u8"> + requestPictureInPicture (ลอยข้ามแอป)       │
│    2. Canvas PiP → captureStream + requestPictureInPicture (Desktop only)        │
│    3. Overlay → fixed div ลากได้ในเว็บ (fallback สุดท้าย)                       │
│    + CSS injection ซ่อน webkit media controls                                   │
│    + Media Session API noop handlers ซ่อนปุ่มควบคุม                             │
│    + playbackState keepalive ทุก 2 วิ                                           │
│                                                                                  │
│  SignalRoomContent.tsx                                                            │
│    - แสดง 6 charts (3x2 grid) ด้วย canvas                                      │
│    - Lock back button (history.pushState)                                        │
│    - Countdown: symbolData[symbol]?.countdown ?? globalCountdown                 │
│                                                                                  │
│  PWA: manifest.json (Add to Home Screen, standalone, no address bar)             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary
```
MT5 → real_time_monitor.py → POST /bridge/update → Render Python API → WebSocket → Frontend
                            └→ POST localhost:8000 → VPS local API → HLS streamer reads data
```

### HLS URL Delivery Chain
```
VPS: HLS_PUBLIC_URL env (or hardcoded default in real_time_monitor.py)
  → real_time_monitor.py แนบใน bridge data
  → POST /bridge/update ไป Render API
  → realtime_api.py cache _bridge_hls_url + ส่งต่อใน WebSocket broadcast
  → Frontend signal-service.ts รับ data.hls_url
  → pip-manager.ts preloadHlsVideo() สร้าง <video> element พร้อมใช้
```

### 6 Trading Symbols
```
AUDUSDm, EURUSDm, GBPUSDm, USDJPYm, EURGBPm, EURJPYm
```

---

## สถานะปัจจุบัน (12 เม.ย. 2026)

### ทำเสร็จแล้ว

#### Infrastructure & Security
- [x] Security Review + แก้ไข 12+ vulnerabilities
- [x] JWT lazy initialization (ไม่ throw ตอน build time)
- [x] Logger + Email alert (korawitns@gmail.com)
- [x] Activity logging ดูได้ที่ Admin > Logs
- [x] Free Trial system (ได้ใช้ Signal ฟรี 30 วัน)
- [x] Affiliate commission lock (ปิดชั่วคราว)
- [x] Admin panel: System Controls + System Logs
- [x] Standalone deployment fix (Render)
- [x] Bridge auth fix: skip auth เมื่อไม่มี API key ตั้ง
- [x] Bridge timeout เพิ่มจาก 2s เป็น 15s (รอ Render cold start)
- [x] WebSocket reconnect: max 50 attempts, cap delay 30s

#### UI & Frontend
- [x] Mobile layout fix (responsive grid, ตัวเลขไม่ซ้อนทับ)
- [x] Login background flash fix
- [x] Signal page แสดง 6 symbols (3x2 grid) แทน 4 symbols เดิม
- [x] PWA manifest.json (Add to Home Screen, standalone, no address bar)
- [x] Lock back button ในหน้า signal

#### HLS Streaming (VPS)
- [x] HLS streamer: Pillow + FFmpeg render chart → HLS stream
- [x] Resolution: 1280x720 HD (readable on small PiP)
- [x] Large fonts: brand 36px, symbol 30px centered, countdown 34px
- [x] Outer padding 20px (iOS PiP rounded corners)
- [x] No Y-axis prices, no signal arrows in header
- [x] Single countdown MM:SS at top-right (MT5 data)
- [x] VPS ส่ง hls_url ผ่าน bridge data อัตโนมัติ
- [x] Render API: pass-through + cache hls_url ใน WebSocket broadcast

#### PiP (Picture-in-Picture)
- [x] pip-manager.ts: pre-load HLS video ทันทีที่ได้ URL จาก WebSocket
- [x] PiP fallback chain: HLS → Canvas → Overlay
- [x] iOS Safari: webkit-first PiP approach (ลอยข้ามแอปได้)
- [x] Android Chrome: native Video PiP (ลอยข้ามแอปได้)
- [x] Desktop Chrome: canvas captureStream PiP
- [x] Overlay fallback: fixed div ลากได้ (สำหรับ browser ที่ไม่รองรับ PiP)
- [x] Overlay dedup guard: ลบ overlay เก่าก่อนสร้างใหม่ (แก้ BUG ซ้อน 2 อัน)
- [x] ลบ PipProvider ซ้อนใน SignalRoomWithProvider (layout ครอบอยู่แล้ว)

#### PiP Control Hiding (Sigzy-style) — ล่าสุด
- [x] CSS injection: ซ่อน webkit media controls pseudo-elements ทั้งหมด
- [x] `controlsList` attribute: nofullscreen nodownload noremoteplayback noplaybackrate
- [x] `x-webkit-airplay="deny"`
- [x] Media Session API: noop handlers สำหรับทุก action (seekbackward, seekforward, previoustrack, nexttrack, skipad, seekto, stop)
- [x] Play/Pause handler: กด pause แล้ว resume ทันที (50ms)
- [x] `playbackState = 'playing'` ก่อน+หลังเข้า PiP
- [x] Keepalive interval ทุก 2 วิ: reset playbackState + auto-resume ถ้าถูก pause

#### Code Cleanup
- [x] ลบ `SignalRooms.tsx` (557 บรรทัด dead code)
- [x] ลบ unused `SignalRoomContent` import จาก signals/page.tsx
- [x] ลบ console.log ทั้งหมดจาก pip-manager.ts และ PipProvider.tsx
- [x] ลบ PipDebugPanel component (~70 บรรทัด)
- [x] ลบ getDebugInfo, lastError fields จาก pip-manager.ts
- [x] ลบ local countdown timer จาก PipProvider.tsx (ใช้ MT5 countdown ตรงๆ)
- [x] แก้ countdown fallback: `||` → `??` (รองรับ countdown=0 ตอนตลาดปิด)

---

## ปัญหาที่ยังเหลืออยู่

### ISSUE 1: Signal Room countdown ยังนับต่อเนื่อง (BACKEND)

**อาการ**: หน้า Signal Room แสดง countdown ที่ยังนับลงเรื่อยๆ แม้ว่า Frontend ไม่มี local timer แล้ว

**สถานะ Frontend**: CLEAN — ไม่มี `setInterval` หรือ local countdown logic แล้ว
- `PipProvider.tsx`: `setGlobalCountdown(data.countdown)` — รับค่าจาก WebSocket ตรงๆ
- `SignalRoomContent.tsx`: `symbolData[symbol]?.countdown ?? globalCountdown` — แสดงค่าที่ได้รับ

**สาเหตุที่น่าจะเป็น**: Backend (`realtime_api.py` หรือ `real_time_monitor.py`) ยังคำนวณ countdown แบบนับลงเอง แทนที่จะส่งค่าจาก MT5 ตรงๆ

**ไฟล์ที่ต้องตรวจสอบ (Backend repo)**:
- `real_time_monitor.py` — ดูว่า countdown ถูกคำนวณอย่างไรก่อนส่งไป bridge
- `api/realtime_api.py` — ดูว่า broadcast_loop มี countdown logic อิสระหรือไม่

**วิธี debug**:
```javascript
// Browser Console ตอน WebSocket connected:
// ดู countdown ที่ได้รับจาก server จริงๆ
signalService.onData((d) => console.log('countdown:', d.countdown))
```

**วิธีแก้ที่ควรทำ**: ให้ `real_time_monitor.py` ส่ง countdown ที่เหลือจริงจาก MT5 server time (คำนวณจาก `seconds_until_next_candle = timeframe_seconds - (server_time % timeframe_seconds)`) ไม่ใช่นับลงจากค่าคงที่

---

### ISSUE 2: iOS PiP ยังแสดงปุ่มควบคุมบางส่วน (PLATFORM LIMITATION)

**อาการ**: PiP บน iOS ลอยข้ามแอปได้แล้ว แต่ยังเห็นปุ่ม play/pause และ close

**สาเหตุ**: iOS PiP controls เป็น **system-level UI** ที่ Apple ควบคุม — ไม่สามารถซ่อน 100% จาก web ได้

**สิ่งที่ทำแล้ว (ทุกเทคนิคที่เป็นไปได้จาก web)**:
1. CSS pseudo-element selectors (`video::-webkit-media-controls` etc.)
2. `controlsList` attribute
3. Media Session API noop handlers
4. `playbackState = 'playing'` keepalive
5. Play/Pause handler: auto-resume ทันทีเมื่อถูก pause

**ผลลัพธ์**: ปุ่ม skip forward/backward หายไปแล้ว เหลือแค่ play/pause + close (system controls)

**ทางเลือกเพิ่มเติม (ถ้าต้องการซ่อน 100%)**:
- **Native iOS App (Swift/SwiftUI)**: ใช้ `AVPlayerViewController` + override PiP controls — ซ่อนได้หมด
- **React Native + expo-av**: PiP ผ่าน native layer — มีโอกาสซ่อนได้มากกว่า web
- **Sigzy ทำได้**: เพราะ Sigzy มี native app (แม้ว่าเริ่มจาก web เหมือนกัน)

---

### ISSUE 3: Cloudflare Quick Tunnel URL ไม่คงที่

**อาการ**: ทุกครั้งที่ restart Cloudflare tunnel บน VPS → URL เปลี่ยน → ต้อง set `HLS_PUBLIC_URL` ใหม่

**Workaround ปัจจุบัน**: Hardcode URL เป็น default value ใน `real_time_monitor.py` line 88:
```python
HLS_PUBLIC_URL = os.environ.get("HLS_PUBLIC_URL", "https://xxx.trycloudflare.com")
```
→ ต้องแก้ค่า default ทุกครั้งที่ restart tunnel

**ทางแก้ระยะยาว**:
1. **Cloudflare Named Tunnel** (ฟรี) — ต้องมี domain name → URL คงที่ตลอด
2. **nginx + certbot + static domain** — self-hosted reverse proxy
3. **Deploy HLS on Render** — ไม่ต้อง tunnel (แต่ Render Free Tier มี limitation)

---

## PiP Fallback Chain (Technical Detail)

```
User กด PiP button (pip-manager.ts toggle())
    │
    ▼
1. startHlsPip()
   - ต้องมี this.hlsUrl (มาจาก WebSocket data.hls_url)
   - ต้องมี this.hlsVideo (pre-loaded ตอนได้ URL)
   - setupViewOnlyMediaSession() ก่อนเข้า PiP
   - เรียก play() + requestPictureInPicture()
   - setupViewOnlyMediaSession() อีกรอบหลัง PiP เริ่ม
   - เริ่ม keepalive interval (playbackState + auto-resume)
   - ถ้าสำเร็จ → ลอยข้ามแอปได้ ✅
   - ถ้า fail → ↓
    │
    ▼
2. startCanvasPip()
   - ใช้ canvas.captureStream(30fps) + hidden video
   - ทำงานบน Desktop Chrome/Edge เท่านั้น
   - iOS Safari ไม่รองรับ captureStream
   - ถ้า fail → ↓
    │
    ▼
3. startPopupPip()
   - ลบ overlay เก่าก่อน (ป้องกันซ้อน)
   - สร้าง fixed div overlay z-index:9999
   - ลากได้ด้วย touch/mouse
   - ลอยในเว็บเท่านั้น ❌ ไม่ข้ามแอป
```

### PiP Control Hiding Techniques (Sigzy-style)

```
1. CSS Injection (init())
   - <style> tag inject ใน <head>
   - Target: video[data-pip-manager]::-webkit-media-controls-*
   - ซ่อน: panel, play-button, start-playback, time-display,
           timeline, seek buttons, fullscreen, captions,
           volume, mute, overlay-enclosure, enclosure
   - Method: display:none + visibility:hidden + opacity:0 + pointer-events:none

2. Video Element Attributes (preloadHlsVideo())
   - controls = false
   - controlsList = "nofullscreen nodownload noremoteplayback noplaybackrate"
   - x-webkit-airplay = "deny"
   - disableRemotePlayback = true

3. Media Session API (setupViewOnlyMediaSession())
   - playbackState = 'playing' (ป้องกัน play button)
   - noop handlers: seekbackward, seekforward, previoustrack,
                     nexttrack, skipad, seekto, stop
   - play handler: video.play() + playbackState = 'playing'
   - pause handler: ignore + resume ทันที (50ms)

4. Keepalive Interval (ทุก 2 วิ)
   - Reset playbackState = 'playing'
   - Auto-resume video ถ้าถูก pause โดย system
   - หยุดอัตโนมัติเมื่อออก PiP
```

---

## Key Files Reference

### Frontend (Next.js) — `github.com/RhereLhee/Web_project_ai_sig`

| File | หน้าที่ | หมายเหตุ |
|---|---|---|
| `lib/signal-service.ts` | WebSocket singleton, reconnect logic, data store | WS URL default: `wss://trading-api-83hs.onrender.com/ws/signal` |
| `lib/pip-manager.ts` | PiP singleton, HLS/Canvas/Overlay fallback chain, control hiding | Pre-loads HLS video, CSS injection, media session keepalive |
| `components/PipProvider.tsx` | React context, subscribe signal-service + pip-manager | Sound alert, NO local countdown (MT5 direct) |
| `components/SignalRoomContent.tsx` | 6 charts (3x2 grid), canvas drawing, back lock | `countdown ?? globalCountdown` (ใช้ `??` ไม่ใช่ `||`) |
| `components/SignalRoomWithProvider.tsx` | Thin wrapper, renders SignalRoomContent | PipProvider ลบออกแล้ว (อยู่ใน layout) |
| `app/(main)/layout.tsx` | Main layout, auth check, PipProviderWrapper | PipProvider อยู่ที่นี่ชั้นเดียว |
| `app/(main)/PipProviderWrapper.tsx` | Conditional PipProvider (เฉพาะ user ที่มี signal) | hasSignal check |
| `app/(main)/signals/page.tsx` | Signal page, auth + trial logic | renders SignalRoomWithProvider |
| `app/layout.tsx` | Root layout, PWA meta, viewport | manifest.json, apple-web-app |
| `public/manifest.json` | PWA manifest | standalone, start_url: /signals |

### Backend (Python) — `github.com/RhereLhee/algorithm_trade_Project`

| File | หน้าที่ | หมายเหตุ |
|---|---|---|
| `real_time_monitor.py` | MT5 data collection, AI prediction, bridge POST | Process 1 บน VPS, timeout 15s |
| `api/realtime_api.py` | FastAPI server, WebSocket broadcast, bridge endpoint | Process 2, deploy ทั้ง VPS + Render, มี /debug/hls |
| `api/hls_streamer.py` | Pillow + FFmpeg chart rendering → HLS stream | 1280x720 HD, large fonts, no prices |
| `api/run_api.py` | FastAPI entry point | Start server + HLS streamer background |
| `config/settings.py` | SYMBOLS, TIMEFRAME_MAP, API keys | 6 symbols |

---

## Environment Variables

### Render (Next.js Frontend)
```bash
DATABASE_URL=postgresql://...@supabase.co:5432/postgres
JWT_ACCESS_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>
ALERT_EMAIL=korawitns@gmail.com
PROMPTPAY_ID=<promptpay-number>

# IMPORTANT: ถ้า set NEXT_PUBLIC_WS_URL ต้องชี้ไป Render API
# ห้ามชี้ไป Cloudflare tunnel (URL เปลี่ยนทุก restart)
# ถ้าไม่ set จะใช้ default: wss://trading-api-83hs.onrender.com/ws/signal
# NEXT_PUBLIC_WS_URL=wss://trading-api-83hs.onrender.com/ws/signal
```

### Render (Python API)
```bash
# ถ้าไม่ set API key → skip auth สำหรับ bridge endpoint
# API_KEY_ADMIN=<key>
# API_KEY_USER=<key>
ALLOWED_ORIGINS=https://techtrade-ztdd.onrender.com,http://localhost:3000
```

### VPS (Python)
```powershell
# Cloudflare tunnel URL ปัจจุบัน (เปลี่ยนทุก restart)
$env:HLS_PUBLIC_URL = "https://xxx.trycloudflare.com"

# หรือ hardcode default ใน real_time_monitor.py line 88:
# HLS_PUBLIC_URL = os.environ.get("HLS_PUBLIC_URL", "https://xxx.trycloudflare.com")

# API key (optional, ถ้าไม่ set Render API จะ skip auth)
# $env:API_KEY_USER = "<key>"
```

---

## Commands

### Frontend (Next.js)
```bash
npm run dev          # Development (localhost:3000)
npm run build        # Build standalone
npm start            # Production (node .next/standalone/server.js)
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema to DB
npx prisma studio    # DB GUI
```

### VPS (Python)
```powershell
# Process 1: Signal monitor (MT5 data + AI + bridge)
python real_time_monitor.py

# Process 2: API server (WebSocket + HLS)
cd api
python run_api.py

# Cloudflare Quick Tunnel (Process 3)
cloudflared tunnel --url http://localhost:8000

# Update code from GitHub
git pull
```

---

## OFFLINE Troubleshooting

ถ้าหน้า signal แสดง OFFLINE:

### Step 1: เช็ค Render API
```bash
curl https://trading-api-83hs.onrender.com/
# ต้องเห็น: {"status":"running","mt5_bridge":"connected",...}
# ถ้า timeout → Render กำลัง cold start (รอ 30-60 วิ)
```

### Step 2: เช็ค Bridge
```bash
curl -X POST https://trading-api-83hs.onrender.com/bridge/update \
  -H "Content-Type: application/json" \
  -d '{"symbols":{}}'
# ต้องเห็น: {"status":"ok","symbols_received":0}
# ถ้า 403 → ต้อง set API key หรือลบ API key ออก
```

### Step 3: เช็ค WebSocket
```bash
# ใช้ wscat หรือ browser console:
new WebSocket('wss://trading-api-83hs.onrender.com/ws/signal')
# ต้อง connect ได้ และรับ data ทุก 1 วินาที
```

### Step 4: เช็ค VPS Monitor
```
- VPS terminal ต้องเห็น: [API Bridge] ไม่มี error
- ถ้าเห็น "Cannot connect" → Render อาจ sleep อยู่
- ถ้าเห็น "HTTP 403" → API key ไม่ตรง
```

### Step 5: เช็ค Frontend env
```
- Render Dashboard > Next.js service > Environment
- NEXT_PUBLIC_WS_URL ต้องไม่ชี้ไป Cloudflare tunnel URL เก่า
- ลบออกเลยดีที่สุด (ใช้ default)
- ถ้าเปลี่ยน env ต้อง trigger rebuild (NEXT_PUBLIC_ ถูก bake ตอน build)
```

---

## Sigzy-Level Features Comparison

| Feature | Sigzy | TechTrade | Status |
|---|---|---|---|
| HLS Streaming | Yes | Yes (VPS FFmpeg 1280x720) | DONE |
| PiP ลอยข้ามแอป (iOS Safari) | Yes | Yes (HLS video PiP) | DONE |
| PiP ลอยข้ามแอป (Android) | Yes | Yes (native video PiP) | DONE |
| PiP ลอยข้ามแอป (Desktop) | Yes | Yes (canvas captureStream) | DONE |
| ซ่อนปุ่ม PiP (100%) | Yes (native app) | Partial (web limitation) | CSS+MediaSession ทำได้เท่าที่ web ทำได้ |
| Lock Back Button | Yes | Yes (history.pushState) | DONE |
| PWA (Add to Home Screen) | Yes | Yes (manifest.json) | DONE |
| Fullscreen (no address bar) | Yes | Yes (PWA standalone) | DONE |
| Native App (iOS/Android) | Yes (มีทีหลัง) | No | ต้องทำถ้าจะซ่อน PiP controls 100% |

---

## Notes
- Supabase Free Tier: auto-pause หลัง 7 วัน → ใช้ UptimeRobot ping `/api/health` ป้องกัน
- Render Free Tier: sleep หลัง 15 นาที → ใช้ UptimeRobot ป้องกัน
- Alert email: korawitns@gmail.com (ไม่ใช่ Telegram)
- Affiliate system: ปิดชั่วคราว (toggle ที่ Admin > System Controls)
- iOS Chrome ไม่รองรับ PiP API → ต้องใช้ Safari เท่านั้น
- Cloudflare Quick Tunnel URL เปลี่ยนทุก restart → ใช้ Named Tunnel + domain แก้ปัญหา
- `NEXT_PUBLIC_` env ถูก bake ตอน build → เปลี่ยนแล้วต้อง rebuild
- PyCharm ไม่เห็น env ที่ set ใน PowerShell → hardcode default ใน code หรือใช้ .env file
