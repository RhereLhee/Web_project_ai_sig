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

## Architecture (Current - 10 เม.ย. 2026)

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
                         │    - Pillow render chart 960x540 (3x2 grid)            │
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
│    - WebSocket /ws/signal → broadcast ไป frontend clients                       │
│    - ส่ง hls_url ต่อไป client (pass-through จาก VPS bridge data)                │
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
│                                                                                  │
│  pip-manager.ts (Singleton - PiP Fallback Chain)                                │
│    1. HLS PiP → <video src="m3u8"> + requestPictureInPicture (ลอยข้ามแอป)       │
│    2. Canvas PiP → captureStream + requestPictureInPicture (Desktop only)        │
│    3. Overlay → fixed div ลากได้ในเว็บ (fallback สุดท้าย)                       │
│                                                                                  │
│  SignalRoomContent.tsx                                                            │
│    - แสดง 6 charts (3x2 grid) ด้วย canvas                                      │
│    - Lock back button (history.pushState)                                        │
│                                                                                  │
│  PWA: manifest.json (Add to Home Screen, standalone, no address bar)             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Summary
```
MT5 → real_time_monitor.py → POST /bridge/update → Render Python API → WebSocket → Frontend
                            └→ POST localhost:8000 → VPS local API → HLS streamer reads data
```

### 6 Trading Symbols
```
AUDUSDm, EURUSDm, GBPUSDm, USDJPYm, EURGBPm, EURJPYm
```

---

## สถานะปัจจุบัน (10 เม.ย. 2026)

### ทำเสร็จแล้ว
- [x] Security Review + แก้ไข 12+ vulnerabilities
- [x] JWT lazy initialization (ไม่ throw ตอน build time)
- [x] Logger + Email alert (korawitns@gmail.com)
- [x] Activity logging ดูได้ที่ Admin > Logs
- [x] Free Trial system (ได้ใช้ Signal ฟรี 30 วัน)
- [x] Affiliate commission lock (ปิดชั่วคราว)
- [x] Admin panel: System Controls + System Logs
- [x] Standalone deployment fix (Render)
- [x] Mobile layout fix (responsive grid, ตัวเลขไม่ซ้อนทับ)
- [x] Login background flash fix
- [x] Signal page แสดง 6 symbols (3x2 grid) แทน 4 symbols เดิม
- [x] Bridge auth fix: skip auth เมื่อไม่มี API key ตั้ง
- [x] Bridge timeout เพิ่มจาก 2s เป็น 15s (รอ Render cold start)
- [x] WebSocket reconnect: max 50 attempts, cap delay 30s
- [x] VPS ส่ง hls_url ผ่าน bridge data อัตโนมัติ
- [x] Frontend รับ hls_url จาก WebSocket data (ไม่ hardcode)
- [x] PWA manifest.json (Add to Home Screen, standalone, no address bar)
- [x] Lock back button ในหน้า signal
- [x] HLS streamer ทำงานบน VPS (FFmpeg + Pillow, 960x540, 3x2 grid)
- [x] PiP: pip-manager.ts pre-load HLS video ทันทีที่ได้ URL
- [x] PiP: Android Chrome ลอยเหนือแอปอื่นได้ (native Video PiP)
- [x] PiP: Desktop Chrome ลอยได้ (canvas captureStream)
- [x] PiP: iOS/mobile fallback เป็น overlay ลากได้ในเว็บ
- [x] OFFLINE fix: ลบ NEXT_PUBLIC_WS_URL ที่ชี้ไป Cloudflare tunnel เก่า
- [x] ลบ PipProvider ซ้อนใน SignalRoomWithProvider (layout ครอบอยู่แล้ว)

---

## BUG ที่ยังไม่ได้แก้

### BUG 1: PiP Overlay ทับซ้อน 2 อัน (CRITICAL)

**อาการ**: กด PiP แล้วเห็นกรอบเขียว 2 อัน ทับกัน

**สาเหตุที่น่าจะเป็น (ยังไม่ confirm)**:

1. **PipProvider ซ้อน 2 ชั้น** — ถูก fix แล้วใน commit `f7f00b2` โดยลบ PipProvider ออกจาก `SignalRoomWithProvider.tsx` เพราะ `layout.tsx` ครอบอยู่แล้ว **แต่ยังไม่ได้ verify ว่า fix จริง** (Render อาจยัง build ไม่เสร็จ หรือ browser cache)

2. **ถ้ายัง fix ไม่ได้** ให้ตรวจสอบ:

   a. **`pip-manager.ts` init()** — ตอน init จะ cleanup ด้วย `document.querySelectorAll('[data-pip-manager]')` แต่ overlay container เดิมไม่มี `data-pip-manager` attribute (fix แล้วใน commit ล่าสุด เพิ่ม `data-pip-manager='overlay'`)

   b. **React StrictMode** — ถ้าเปิด StrictMode จะ mount/unmount 2 รอบใน dev mode ทำให้ singleton อาจถูก init 2 ครั้ง

   c. **Hot reload / Fast Refresh** — singleton ไม่ถูก destroy ตอน hot reload ทำให้มี element ค้างใน DOM

**วิธี debug**:
```javascript
// เปิด Chrome DevTools Console แล้วรัน:
document.querySelectorAll('#pip-overlay').length
// ถ้าได้ > 1 = overlay ซ้อนจริง

document.querySelectorAll('[data-pip-manager]').length
// ดูจำนวน element ทั้งหมดที่ pip-manager สร้าง
```

**วิธีแก้ถ้ายังซ้อน**:
```typescript
// ใน pip-manager.ts startPopupPip() เพิ่มก่อนสร้าง overlay ใหม่:
const existing = document.getElementById('pip-overlay')
if (existing) existing.remove()
```

**ไฟล์ที่เกี่ยว**:
- `lib/pip-manager.ts` line 403-457 (startPopupPip)
- `lib/pip-manager.ts` line 97-103 (init cleanup)
- `components/PipProvider.tsx` (provider wrapper)
- `app/(main)/layout.tsx` line 32 (PipProviderWrapper)
- `app/(main)/PipProviderWrapper.tsx` (conditional wrapper)
- `components/SignalRoomWithProvider.tsx` (ลบ PipProvider ซ้อนแล้ว)

---

### BUG 2: PiP ลอยข้ามแอปไม่ได้บน iOS (MAJOR)

**อาการ**: กด PiP บน iOS → ได้แค่ overlay ลอยในเว็บ ไม่ลอยข้ามแอปอื่น

**สาเหตุ**: HLS PiP ถูก skip → fallback ไป overlay เพราะ:

1. **VPS ยังไม่ได้ set `HLS_PUBLIC_URL` env** → `hls_url` ไม่ถูกส่งมาใน bridge data → frontend ไม่มี URL → skip HLS mode

2. **Cloudflare Quick Tunnel URL เปลี่ยนทุกครั้งที่ restart** → ต้อง set env ใหม่ทุกครั้ง → ไม่ practical

3. **iOS Safari gesture token timeout** → ถ้า HLS video ยัง load ไม่เสร็จตอนกด PiP → `requestPictureInPicture()` ถูก reject → **fix แล้ว** ด้วย pre-load approach (commit `1706b5f`)

4. **iOS Chrome ไม่รองรับ PiP API เลย** → ต้องใช้ Safari เท่านั้น

**PiP Fallback Chain ปัจจุบัน** (`lib/pip-manager.ts`):
```
User กด PiP button
    │
    ▼
1. startHlsPip()
   - ต้องมี this.hlsUrl (มาจาก WebSocket data.hls_url)
   - ต้องมี this.hlsVideo (pre-loaded ตอนได้ URL)
   - เรียก play() + requestPictureInPicture() ทันที
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
   - สร้าง fixed div overlay z-index:9999
   - ลากได้ด้วย touch/mouse
   - ลอยในเว็บเท่านั้น ❌ ไม่ข้ามแอป
```

**สิ่งที่ต้องทำเพื่อให้ HLS PiP ทำงาน (end-to-end)**:

| Step | ที่ไหน | ทำอะไร | สถานะ |
|---|---|---|---|
| 1 | VPS | ติดตั้ง FFmpeg | DONE |
| 2 | VPS | `hls_streamer.py` render chart → HLS | DONE |
| 3 | VPS | `realtime_api.py` mount /stream/ + start streamer | DONE |
| 4 | VPS | Cloudflare Tunnel HTTPS | DONE (Quick Tunnel) |
| 5 | VPS | set `HLS_PUBLIC_URL` env | **TODO** |
| 6 | VPS | `real_time_monitor.py` แนบ hls_url ใน bridge data | DONE |
| 7 | Render API | pass-through hls_url ใน WebSocket broadcast | DONE |
| 8 | Frontend | `signal-service.ts` รับ hls_url | DONE |
| 9 | Frontend | `pip-manager.ts` pre-load HLS video | DONE |
| 10 | Frontend | `pip-manager.ts` instant play + requestPiP | DONE |
| 11 | User | ต้องใช้ Safari (ไม่ใช่ Chrome) บน iOS | N/A |

**ปัญหา Cloudflare Quick Tunnel**:
- URL เปลี่ยนทุกครั้งที่ restart (e.g., `https://abc-xyz.trycloudflare.com`)
- ต้อง set `$env:HLS_PUBLIC_URL` ใหม่ทุกครั้ง
- **ทางแก้ระยะยาว**: ใช้ Cloudflare Named Tunnel (ต้องมี domain) หรือ nginx + certbot + static domain

**วิธี test HLS PiP บน iOS**:
```
1. VPS: เปิด Cloudflare tunnel → จด URL
2. VPS: $env:HLS_PUBLIC_URL = "https://xxx.trycloudflare.com"
3. VPS: restart real_time_monitor.py + run_api.py
4. iOS: เปิด Safari (ไม่ใช่ Chrome!)
5. iOS: ไปที่ techtrade-ztdd.onrender.com/signals
6. iOS: กด PiP button
7. Console ควรเห็น: "HLS video pre-loaded and ready for PiP"
8. ถ้าสำเร็จ: เห็น video ลอยข้ามแอป
9. ถ้า fail: ดู console log → "HLS PiP failed" + error message
```

---

### BUG 3: Dead Code ที่ควรลบ

| File | เหตุผล |
|---|---|
| `app/(main)/signals/SignalRooms.tsx` (557 lines) | Component เก่า ไม่ถูก import ที่ไหน มี PiP แบบเก่าที่ใช้ HTTP polling + canvas PiP เท่านั้น |
| `signals/page.tsx` line 4 | Import `SignalRoomContent` แต่ไม่ใช้ (ใช้ `SignalRoomWithProvider` แทน) |
| `pip-manager.ts` field `popupWindow` | Dead field ไม่เคย assign ค่า แค่ cleanup |

---

## Key Files Reference

### Frontend (Next.js) — `C:\projectP4\techtrade`

| File | หน้าที่ | หมายเหตุ |
|---|---|---|
| `lib/signal-service.ts` | WebSocket singleton, reconnect logic, data store | WS URL default: `wss://trading-api-83hs.onrender.com/ws/signal` |
| `lib/pip-manager.ts` | PiP singleton, HLS/Canvas/Overlay fallback chain | Pre-loads HLS video, 640x360 canvas, 30fps |
| `components/PipProvider.tsx` | React context, subscribe signal-service + pip-manager | Sound alert, local countdown timer |
| `components/SignalRoomContent.tsx` | 6 charts (3x2 grid), canvas drawing, back lock | Active component |
| `components/SignalRoomWithProvider.tsx` | Thin wrapper, renders SignalRoomContent | PipProvider ลบออกแล้ว (อยู่ใน layout) |
| `app/(main)/layout.tsx` | Main layout, auth check, PipProviderWrapper | PipProvider อยู่ที่นี่ |
| `app/(main)/PipProviderWrapper.tsx` | Conditional PipProvider (เฉพาะ user ที่มี signal) | hasSignal check |
| `app/(main)/signals/page.tsx` | Signal page, auth + trial logic | renders SignalRoomWithProvider |
| `app/layout.tsx` | Root layout, PWA meta, viewport | manifest.json, apple-web-app |
| `public/manifest.json` | PWA manifest | standalone, start_url: /signals |

### Backend (Python) — `C:\Users\Administrator\PycharmProjects\pythonProject3` (VPS)

| File | หน้าที่ | หมายเหตุ |
|---|---|---|
| `real_time_monitor.py` | MT5 data collection, AI prediction, bridge POST | Process 1 บน VPS, timeout 15s |
| `api/realtime_api.py` | FastAPI server, WebSocket broadcast, bridge endpoint | Process 2 (run_api.py), deploy ทั้ง VPS + Render |
| `api/hls_streamer.py` | Pillow + FFmpeg chart rendering → HLS stream | 960x540, 5fps, 3x2 grid |
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

### Common Pitfall
```
NEXT_PUBLIC_WS_URL ถ้า set เป็น Cloudflare tunnel URL
→ tunnel restart → URL เปลี่ยน → frontend ชี้ไป URL เก่า → OFFLINE ตลอด
→ ทางแก้: ลบ env ออก ให้ใช้ Render URL เป็น default
→ HLS URL จะมาจาก WebSocket data (dynamic, ไม่ต้อง hardcode)
```

---

## Sigzy-Level Features Comparison

| Feature | Sigzy | TechTrade | Status |
|---|---|---|---|
| HLS Streaming | Yes | Yes (VPS FFmpeg) | Code done, env not set |
| Custom Video Player | Yes | N/A (chart, not video) | Not needed |
| Lock Back Button | Yes | Yes (history.pushState) | DONE |
| SPA (no reload) | Yes | Yes (Next.js) | DONE |
| PWA (Add to Home Screen) | Yes | Yes (manifest.json) | DONE |
| iOS PiP (float over apps) | Yes | HLS pre-load ready | Needs VPS env + Safari test |
| Fullscreen (no address bar) | Yes | Yes (PWA standalone) | DONE |

---

## Notes
- Supabase Free Tier: auto-pause หลัง 7 วัน → ใช้ UptimeRobot ping `/api/health` ป้องกัน
- Render Free Tier: sleep หลัง 15 นาที → ใช้ UptimeRobot ป้องกัน
- Alert email: korawitns@gmail.com (ไม่ใช่ Telegram)
- Affiliate system: ปิดชั่วคราว (toggle ที่ Admin > System Controls)
- iOS Chrome ไม่รองรับ PiP API → ต้องใช้ Safari เท่านั้น
- Cloudflare Quick Tunnel URL เปลี่ยนทุก restart → ใช้ Named Tunnel + domain แก้ปัญหา
- `NEXT_PUBLIC_` env ถูก bake ตอน build → เปลี่ยนแล้วต้อง rebuild
