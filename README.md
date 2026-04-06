# TechTrade - AI Trading Signal Platform

## Tech Stack
- **Frontend**: Next.js 16.1.1 (App Router, TypeScript, Tailwind CSS)
- **Database**: PostgreSQL via Supabase (Free Tier) + Prisma ORM 5.22.0
- **Auth**: JWT (jose) with httpOnly cookies, Access/Refresh tokens
- **Deploy Frontend**: Render Free Tier (standalone mode)
- **Signal Backend**: Python FastAPI + MetaTrader5 on Windows VPS
  - VPS Path: `C:\Users\ASUS\PycharmProjects\pythonProject3`
  - API URL: `https://trading-api-83hs.onrender.com`
  - WebSocket: `/ws/signal` (broadcast ทุก 1 วินาที)

---

## สถานะปัจจุบัน (6 เม.ย. 2026)

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
- [x] PiP: Android Chrome ลอยเหนือแอปอื่นได้ (native Video PiP)
- [x] PiP: iOS/mobile fallback เป็น overlay ลากได้ในเว็บ

---

## ปัญหาที่กำลังติด: PiP บน iOS ลอยเหนือแอปอื่นไม่ได้

### สาเหตุ
iOS Safari **ไม่รองรับ** `canvas.captureStream()` ทำให้ไม่สามารถ:
- แปลง canvas → video stream → requestPictureInPicture
- ปัดออกจาก browser แล้ว PiP ยังลอยอยู่

### ผลลัพธ์ปัจจุบัน
- **Android Chrome**: PiP ลอยเหนือแอปอื่นได้ ✅
- **iOS Safari**: ได้แค่ overlay ลอยในเว็บ ปัดออกก็หาย ❌
- **Desktop Chrome**: PiP ลอยได้ ✅

### เป้าหมาย
ต้องการให้ PiP ลอยเหนือแอปอื่นได้ทุก platform เหมือน Sigzy (เจ้าตลาด)

---

## แผนแก้ไข: HLS Live Stream

### แนวคิด
iOS Safari รองรับ PiP สำหรับ **HLS video จริง** เต็มที่
→ render กราฟบน server เป็น video stream แทน canvas

```
Python VPS:
signal_service.py → mt5_bridge_data → hls_streamer.py → FFmpeg → HLS (.m3u8 + .ts)
                                                                        ↓
Client (iOS Safari):
<video src="https://vps-url/stream/signal.m3u8"> → requestPictureInPicture → ลอยเหนือแอป ✓
```

### สิ่งที่ต้องทำ

#### 1. Python VPS (`C:\Users\ASUS\PycharmProjects\pythonProject3`)

| งาน | รายละเอียด |
|---|---|
| สร้าง `api/hls_streamer.py` | Render กราฟด้วย Pillow → pipe frames ไป FFmpeg → output HLS |
| แก้ `api/realtime_api.py` | Mount `stream/` directory + start streamer background task |
| ติดตั้ง FFmpeg | ถ้ายังไม่มี ดาวน์โหลดจาก ffmpeg.org |
| ติดตั้ง Pillow | `pip install Pillow` |

**hls_streamer.py spec:**
- Input: signal data จาก `mt5_bridge_data` (global var ใน realtime_api.py)
- Render: 640x360, 2x2 candlestick grid + header + countdown + signal arrows
- FPS: 5-10 (กราฟ update ทุก 1 วิ)
- FFmpeg: `libx264 ultrafast -tune zerolatency`, HLS 2s segments, keep 5 segments
- Output: `stream/signal.m3u8` + `stream/signal*.ts`

#### 2. Next.js Frontend (`C:\projectP4\techtrade`)

| งาน | รายละเอียด |
|---|---|
| แก้ `lib/pip-manager.ts` | iOS → ใช้ `<video src="HLS">` + PiP แทน canvas |
| เพิ่ม env var | `NEXT_PUBLIC_HLS_STREAM_URL` |

**PiP logic ใหม่:**
1. Android/Desktop → ลอง native canvas PiP ก่อน (ทำงานอยู่แล้ว)
2. iOS → ใช้ `<video src="m3u8">` แล้ว `requestPictureInPicture()` (Safari รองรับ HLS natively)
3. Fallback → overlay ลากได้

#### 3. Infrastructure

| งาน | รายละเอียด |
|---|---|
| HTTPS สำหรับ HLS | ต้องมี SSL (iOS บังคับ) — ใช้ Cloudflare Tunnel หรือ nginx + certbot |
| CORS | อนุญาต TechTrade domain เข้าถึง stream |
| Port | ใช้ port เดียวกับ API (8000) หรือเปิด port ใหม่ |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Windows VPS                                      │
│                                                  │
│  MT5 Terminal → signal_service.py (V7)           │
│                      │ HTTP POST                 │
│                      ▼                           │
│              FastAPI realtime_api.py (:8000)      │
│              ├── WebSocket /ws/signal (1s)        │
│              ├── REST API /api/*                  │
│              └── HLS /stream/signal.m3u8 (TODO)   │
│                      ▲                           │
│              hls_streamer.py (TODO)               │
│              Pillow render → FFmpeg → HLS         │
└─────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────┐
│ Render (Free Tier)                               │
│  Next.js TechTrade Frontend                      │
│  ├── Signal Room (canvas charts via WebSocket)   │
│  ├── PiP: Android/Desktop = native canvas PiP   │
│  ├── PiP: iOS = HLS video PiP (TODO)            │
│  └── Admin Panel (logs, settings, controls)      │
│                                                  │
│  Database: Supabase PostgreSQL (Free Tier)       │
└─────────────────────────────────────────────────┘
```

---

## Environment Variables

### Render (Next.js)
```
DATABASE_URL=postgresql://...@supabase.co:5432/postgres
JWT_ACCESS_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASS=<app-password>
ALERT_EMAIL=korawitns@gmail.com
PROMPTPAY_ID=<promptpay-number>
NEXT_PUBLIC_HLS_STREAM_URL=https://<vps-domain>/stream/signal.m3u8  # TODO
```

### VPS (Python)
```
DATABASE_URL=postgresql://...
API_KEY_ADMIN=<key>
API_KEY_USER=<key>
API_KEY_READONLY=<key>
ALLOWED_ORIGINS=https://techtrade-ztdd.onrender.com,http://localhost:3000
```

---

## Commands

```bash
# Next.js Development
npm run dev

# Next.js Build (standalone + copy static)
npm run build

# Next.js Production
npm start  # node .next/standalone/server.js

# Prisma
npx prisma generate
npx prisma db push
npx prisma studio

# VPS - Signal Service
python signal_service.py

# VPS - API Server
cd api && python run_api.py
```

---

## Notes
- Supabase Free Tier: auto-pause หลัง 7 วัน → ใช้ UptimeRobot ping `/api/health` ป้องกัน
- Render Free Tier: sleep หลัง 15 นาที → ใช้ UptimeRobot ป้องกัน
- Alert email: korawitns@gmail.com (ไม่ใช่ Telegram)
- Affiliate system: ปิดชั่วคราว (toggle ที่ Admin > System Controls)
