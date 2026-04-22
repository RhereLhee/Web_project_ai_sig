// app/(auth)/register/RegisterForm.tsx
"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

type Step = 'form' | 'otp' | 'complete'

export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refCode = searchParams.get("ref") || ""
  
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    referralCode: refCode,
  })
  
  const [otp, setOtp] = useState("")
  const [countdown, setCountdown] = useState(0)

  // ============================================
  // STEP 1: Submit Form Send Email OTP
  // ============================================
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (formData.password !== formData.confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน")
      return
    }

    if (formData.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร")
      return
    }

    setLoading(true)

    try {
      // ส่ง Email OTP
      const res = await fetch("/api/auth/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: formData.email,
          type: 'REGISTER',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด")
        return
      }

      setStep('otp')
      startCountdown(300)

    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // STEP 2: Verify OTP Register
  // ============================================
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError("กรุณากรอกรหัส OTP 6 หลัก")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Verify OTP
      const verifyRes = await fetch("/api/auth/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: formData.email,
          code: otp,
          type: 'REGISTER',
        }),
      })

      const verifyData = await verifyRes.json()

      if (!verifyRes.ok) {
        setError(verifyData.error || "รหัส OTP ไม่ถูกต้อง")
        return
      }

      // Register
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          verificationToken: verifyData.verificationToken,
          referralCode: formData.referralCode,
        }),
      })

      const registerData = await registerRes.json()

      if (!registerRes.ok) {
        setError(registerData.error || "สมัครสมาชิกไม่สำเร็จ")
        return
      }

      setStep('complete')

    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // HELPERS
  // ============================================
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

  const resendOtp = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: formData.email,
          type: 'REGISTER',
        }),
      })

      if (res.ok) {
        startCountdown(300)
      } else {
        const data = await res.json()
        setError(data.error || "ส่ง OTP ไม่สำเร็จ")
      }
    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // Background Component
  // ============================================
  const Background = () => (
    <div className="absolute inset-0 z-0">
      <Image
        src="/auth-bg1.png"
        alt="Background"
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-black/40" />
    </div>
  )

  // ============================================
  // RENDER: Complete
  // ============================================
  if (step === 'complete') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
        <Background />
        <div className="relative z-10 w-full max-w-md">
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl text-center">
            <div className="text-6xl mb-4"></div>
            <h1 className="text-2xl font-bold text-white mb-2">สมัครสมาชิกสำเร็จ!</h1>
            <p className="text-gray-400 mb-6">ยินดีต้อนรับสู่ TechTrade</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: OTP
  // ============================================
  if (step === 'otp') {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4">
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
            <p className="text-gray-400 text-center mb-4">ยืนยันอีเมล</p>

            <div className="text-center mb-6">
              <div className="text-4xl mb-3"></div>
              <p className="text-gray-300">
                เราส่งรหัส OTP ไปที่<br />
                <span className="font-semibold text-white">{formData.email}</span>
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm mb-4 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">รหัส OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
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
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition"
              >
                {loading ? "กำลังตรวจสอบ..." : "ยืนยัน"}
              </button>

              <button
                onClick={resendOtp}
                disabled={loading || countdown > 0}
                className="w-full bg-gray-700/50 hover:bg-gray-600/50 disabled:bg-gray-800/50 disabled:cursor-not-allowed text-gray-300 font-semibold py-3 px-4 rounded-lg transition"
              >
                ส่งรหัสอีกครั้ง
              </button>

              <button
                onClick={() => setStep('form')}
                className="w-full text-sm text-gray-400 hover:text-gray-300 transition"
              >
                ย้อนกลับ
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: Form
  // ============================================
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
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
          <p className="text-gray-400 text-center mb-6">สมัครสมาชิก</p>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ชื่อ</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                placeholder="ชื่อของคุณ"
                required
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">อีเมล</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                placeholder="email@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">* ใช้ยืนยันตัวตนด้วย OTP</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">เบอร์โทรศัพท์</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                placeholder="08X-XXX-XXXX"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                placeholder="อย่างน้อย 6 ตัวอักษร"
                minLength={6}
                required
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ยืนยันรหัสผ่าน</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                placeholder="กรอกรหัสผ่านอีกครั้ง"
                minLength={6}
                required
              />
            </div>

            {/* Referral Code */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                รหัสแนะนำ <span className="text-gray-500">(ถ้ามี)</span>
              </label>
              <input
                type="text"
                value={formData.referralCode}
                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-600/50 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                placeholder="รหัสจากผู้แนะนำ"
              />
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition"
            >
              {loading ? "กำลังดำเนินการ..." : "สมัครสมาชิก"}
            </button>
          </form>

          {/* Tagline */}
          <p className="text-center text-gray-500 text-sm mt-6">
            Data-driven decisions start here.
          </p>

          {/* Login Link */}
          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">
              มีบัญชีแล้ว?{" "}
              <Link href="/login" className="text-blue-400 hover:text-blue-300 transition">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}