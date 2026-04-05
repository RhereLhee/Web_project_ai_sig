// app/(auth)/login/page.tsx
// Login Page
// - User ปกติ: Email + Password (ถ้าเครื่องใหม่ → Email OTP)
// - Admin: Email + Password + TOTP

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

type Step = 'login' | '2fa' | 'device_verify'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Form data
  const [formData, setFormData] = useState({ 
    email: "", 
    password: "" 
  })
  
  // 2FA / Device verification
  const [totpCode, setTotpCode] = useState("")
  const [deviceCode, setDeviceCode] = useState("")
  const [deviceInfo, setDeviceInfo] = useState<any>(null)
  const [countdown, setCountdown] = useState(0)

  // ============================================
  // STEP 1: Login
  // ============================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          totpCode: totpCode || undefined,
          deviceCode: deviceCode || undefined,
        }),
      })

      const data = await res.json()

      // ต้องใช้ 2FA (Admin)
      if (data.requires2FA) {
        setStep('2fa')
        setLoading(false)
        return
      }

      // ต้อง verify เครื่องใหม่
      if (data.requiresDeviceVerification) {
        setDeviceInfo(data.deviceInfo)
        setStep('device_verify')
        // ส่ง Email OTP
        await sendDeviceOtp(data.email)
        setLoading(false)
        return
      }

      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ")
        setLoading(false)
        return
      }

      // Login สำเร็จ
      router.push("/dashboard")
      router.refresh()
      
    } catch (err) {
      setError("เกิดข้อผิดพลาด")
      setLoading(false)
    }
  }

  // ============================================
  // STEP 2: Verify 2FA (Admin)
  // ============================================
  const handleVerify2FA = async () => {
    if (totpCode.length !== 6) {
      setError("กรุณากรอกรหัส OTP 6 หลัก")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          totpCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "รหัส OTP ไม่ถูกต้อง")
        setLoading(false)
        return
      }

      // Login สำเร็จ
      router.push("/dashboard")
      router.refresh()
      
    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // STEP 3: Verify Device (New Device)
  // ============================================
  const handleVerifyDevice = async () => {
    if (deviceCode.length !== 6) {
      setError("กรุณากรอกรหัส OTP 6 หลัก")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          deviceCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "ยืนยันตัวตนไม่สำเร็จ")
        setLoading(false)
        return
      }

      // Login สำเร็จ
      router.push("/dashboard")
      router.refresh()
      
    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // HELPERS
  // ============================================
  const sendDeviceOtp = async (email: string) => {
    try {
      const res = await fetch("/api/auth/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email,
          type: 'NEW_DEVICE',
        }),
      })

      if (res.ok) {
        startCountdown(300)
      }
    } catch {
      // Ignore
    }
  }

  const startCountdown = (seconds: number) => {
    setCountdown(seconds)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ============================================
  // Background Component
  // ============================================
  const Background = () => (
    <div className="absolute inset-0 z-0 bg-gray-900">
      <Image
        src="/auth-bg1.png"
        alt="Background"
        fill
        className="object-cover transition-opacity duration-300"
        priority
        quality={85}
        sizes="100vw"
        placeholder="empty"
      />
      <div className="absolute inset-0 bg-black/40" />
    </div>
  )

  // ============================================
  // RENDER: Device Verification
  // ============================================
  if (step === 'device_verify') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 bg-gray-900">
        <Background />
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="flex justify-center mb-6">
              <Image
                src="/logo_wihtetext.png"
                alt="TechTrade"
                width={200}
                height={60}
                className="h-12 w-auto object-contain"
                priority
              />
            </div>
            <p className="text-gray-400 text-center mb-4">ยืนยันเครื่องใหม่</p>

            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔐</div>
              <p className="text-gray-300 mb-2">ตรวจพบการเข้าสู่ระบบจากเครื่องใหม่</p>
              {deviceInfo && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-400">
                  <p>{deviceInfo.device} • {deviceInfo.browser}</p>
                  <p>{deviceInfo.os}</p>
                </div>
              )}
              <p className="text-gray-300 mt-3">
                เราส่งรหัส OTP ไปที่อีเมลของคุณแล้ว
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm mb-4 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">รหัส OTP</label>
                <input
                  type="text"
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>

              {countdown > 0 && (
                <p className="text-center text-sm text-gray-400">
                  รหัสหมดอายุใน {formatCountdown(countdown)}
                </p>
              )}

              <button
                onClick={handleVerifyDevice}
                disabled={loading || deviceCode.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
              </button>

              <button
                onClick={() => sendDeviceOtp(formData.email)}
                disabled={loading || countdown > 0}
                className="w-full bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed text-gray-300 font-semibold py-3 px-4 rounded-lg transition"
              >
                ส่งรหัสอีกครั้ง
              </button>

              <button
                onClick={() => {
                  setStep('login')
                  setDeviceCode('')
                  setDeviceInfo(null)
                }}
                className="text-sm text-gray-400 hover:text-gray-300 w-full text-center"
              >
                ← ย้อนกลับ
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: 2FA (Admin)
  // ============================================
  if (step === '2fa') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 bg-gray-900">
        <Background />
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="flex justify-center mb-6">
              <Image
                src="/logo_wihtetext.png"
                alt="TechTrade"
                width={200}
                height={60}
                className="h-12 w-auto object-contain"
                priority
              />
            </div>
            <p className="text-gray-400 text-center mb-4">ยืนยันตัวตน 2 ขั้นตอน</p>

            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔑</div>
              <p className="text-gray-300">
                กรุณากรอกรหัส OTP จาก<br />
                <span className="font-semibold text-white">Google Authenticator</span>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm mb-4 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">รหัส OTP</label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button
                onClick={handleVerify2FA}
                disabled={loading || totpCode.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
              </button>

              <button
                onClick={() => {
                  setStep('login')
                  setTotpCode('')
                }}
                className="text-sm text-gray-400 hover:text-gray-300 w-full text-center"
              >
                ← ย้อนกลับ
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: Login Form
  // ============================================
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-gray-900">
      <Background />
      <div className="relative z-10 w-full max-w-md">
        {/* Glass Card */}
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/logo_wihtetext.png"
              alt="TechTrade"
              width={200}
              height={60}
              className="h-12 w-auto object-contain"
              priority
            />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  placeholder="Email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  placeholder="Password"
                  required
                />
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center text-gray-400">
                <input type="checkbox" className="mr-2 rounded bg-white/10 border-white/20" />
                <span>จดจำฉัน</span>
              </label>
              <Link href="/forgot-password" className="text-gray-400 hover:text-white transition">
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition duration-200"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "Log In"}
            </button>
          </form>

          {/* Tagline */}
          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">Data-driven decisions start here.</p>
          </div>

          {/* Register Link */}
          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">
              ยังไม่มีบัญชี?{" "}
              <Link href="/register" className="text-blue-400 hover:text-blue-300 transition">
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}