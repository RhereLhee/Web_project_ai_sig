// app/(auth)/register/RegisterForm.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

type Step = 'form' | 'otp' | 'complete'

type FieldKey = 'name' | 'email' | 'phone' | 'password' | 'confirmPassword'
type FieldErrors = Partial<Record<FieldKey, string>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^0[689]\d{8}$/

export default function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refCode = searchParams.get("ref") || ""

  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

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
  const otpAutoSubmittedRef = useRef(false)

  const inputCls = (hasError: boolean) =>
    `w-full bg-gray-800/50 border rounded-lg px-4 py-3 text-white placeholder-gray-500 outline-none transition ${
      hasError
        ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500'
        : 'border-gray-600/50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
    }`

  const setField = (key: FieldKey | 'referralCode', value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    if (key !== 'referralCode' && fieldErrors[key]) {
      setFieldErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const validateForm = (): FieldErrors => {
    const errs: FieldErrors = {}
    if (!formData.name.trim()) errs.name = 'กรุณากรอกชื่อ'
    if (!formData.email.trim()) errs.email = 'กรุณากรอกอีเมล'
    else if (!EMAIL_RE.test(formData.email.trim())) errs.email = 'รูปแบบอีเมลไม่ถูกต้อง'
    if (!formData.phone.trim()) errs.phone = 'กรุณากรอกเบอร์โทรศัพท์'
    else if (!PHONE_RE.test(formData.phone.replace(/[^\d]/g, ''))) errs.phone = 'เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)'
    if (!formData.password) errs.password = 'กรุณากรอกรหัสผ่าน'
    else if (formData.password.length < 6) errs.password = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
    if (!formData.confirmPassword) errs.confirmPassword = 'กรุณายืนยันรหัสผ่าน'
    else if (formData.password && formData.password !== formData.confirmPassword) errs.confirmPassword = 'รหัสผ่านไม่ตรงกัน'
    return errs
  }

  // ============================================
  // STEP 1: Submit Form Send Email OTP
  // ============================================
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const errs = validateForm()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    setLoading(true)

    try {
      // ส่ง Email OTP — ส่ง phone ไปด้วยเพื่อให้ backend เช็คซ้ำก่อน OTP
      const res = await fetch("/api/auth/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          phone: formData.phone,
          type: 'REGISTER',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Backend อาจตอบกลับ field-specific error มาด้วย
        if (data?.field === 'email' || data?.field === 'phone') {
          setFieldErrors({ [data.field]: data.error })
        } else {
          setError(data.error || "เกิดข้อผิดพลาด")
        }
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
        setOtp("")
        otpAutoSubmittedRef.current = false
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
    otpAutoSubmittedRef.current = false
    setOtp("")

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

  // Auto-submit เมื่อกรอก OTP ครบ 6 หลัก — กันยิงซ้ำด้วย ref
  useEffect(() => {
    if (step === 'otp' && otp.length === 6 && !loading && !otpAutoSubmittedRef.current) {
      otpAutoSubmittedRef.current = true
      handleVerifyOtp()
    }
    if (otp.length < 6) {
      otpAutoSubmittedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step])

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

          <form onSubmit={handleSubmitForm} className="space-y-4" noValidate>
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
                onChange={(e) => setField('name', e.target.value)}
                className={inputCls(!!fieldErrors.name)}
                placeholder="ชื่อของคุณ"
              />
              {fieldErrors.name && <p className="text-xs text-red-400 mt-1">{fieldErrors.name}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">อีเมล</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setField('email', e.target.value)}
                className={inputCls(!!fieldErrors.email)}
                placeholder="email@example.com"
              />
              {fieldErrors.email
                ? <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>
                : <p className="text-xs text-gray-500 mt-1">* ใช้ยืนยันตัวตนด้วย OTP</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">เบอร์โทรศัพท์</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className={inputCls(!!fieldErrors.phone)}
                placeholder="08X-XXX-XXXX"
              />
              {fieldErrors.phone && <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setField('password', e.target.value)}
                className={inputCls(!!fieldErrors.password)}
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
              {fieldErrors.password && <p className="text-xs text-red-400 mt-1">{fieldErrors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">ยืนยันรหัสผ่าน</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setField('confirmPassword', e.target.value)}
                className={inputCls(!!fieldErrors.confirmPassword)}
                placeholder="กรอกรหัสผ่านอีกครั้ง"
              />
              {fieldErrors.confirmPassword && <p className="text-xs text-red-400 mt-1">{fieldErrors.confirmPassword}</p>}
            </div>

            {/* Referral Code */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                รหัสแนะนำ <span className="text-gray-500">(ถ้ามี)</span>
              </label>
              <input
                type="text"
                value={formData.referralCode}
                onChange={(e) => setField('referralCode', e.target.value)}
                className={inputCls(false)}
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