"use client"

import { useState, useEffect, useRef } from "react"
import { auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "@/lib/firebase"
import { validateThaiPhone, formatPhoneToE164 } from "@/lib/validators"

interface PhoneOTPVerificationProps {
  /** เบอร์ที่ล็อคไว้แล้ว (ถ้ามี) */
  lockedPhone?: string | null
  /** Callback เมื่อยืนยัน OTP สำเร็จ */
  onVerified: (phone: string) => void
  /** Callback เมื่อยกเลิก */
  onCancel: () => void
  /** ข้อความแสดง */
  title?: string
}

type Step = "input" | "verify"

export function PhoneOTPVerification({
  lockedPhone,
  onVerified,
  onCancel,
  title = "ยืนยันเบอร์โทรศัพท์",
}: PhoneOTPVerificationProps) {
  const [step, setStep] = useState<Step>("input")
  const [phone, setPhone] = useState(lockedPhone || "")
  const [otp, setOtp] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  
  const recaptchaRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Initialize reCAPTCHA
  const initRecaptcha = () => {
    if (!recaptchaVerifierRef.current && recaptchaRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
        "expired-callback": () => {
          setError("reCAPTCHA หมดอายุ กรุณาลองใหม่")
          recaptchaVerifierRef.current = null
        },
      })
    }
  }

  // Send OTP
  const handleSendOTP = async () => {
    setError("")
    
    // Validate phone
    const phoneToUse = lockedPhone || phone
    const validation = validateThaiPhone(phoneToUse)
    if (!validation.valid) {
      setError(validation.error || "เบอร์โทรไม่ถูกต้อง")
      return
    }

    setLoading(true)

    try {
      initRecaptcha()
      
      if (!recaptchaVerifierRef.current) {
        throw new Error("ไม่สามารถสร้าง reCAPTCHA ได้")
      }

      const phoneE164 = formatPhoneToE164(validation.formatted!)
      const result = await signInWithPhoneNumber(auth, phoneE164, recaptchaVerifierRef.current)
      
      setConfirmationResult(result)
      setStep("verify")
      setCountdown(60) // 60 วินาที ส่งใหม่ได้
      
    } catch (err: any) {
      console.error("Send OTP error:", err)
      
      // Reset reCAPTCHA on error
      recaptchaVerifierRef.current = null
      
      if (err.code === "auth/too-many-requests") {
        setError("ส่ง OTP บ่อยเกินไป กรุณารอสักครู่")
      } else if (err.code === "auth/invalid-phone-number") {
        setError("เบอร์โทรไม่ถูกต้อง")
      } else {
        setError("ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่")
      }
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP
  const handleVerifyOTP = async () => {
    setError("")
    
    if (otp.length !== 6) {
      setError("รหัส OTP ต้องมี 6 หลัก")
      return
    }

    if (!confirmationResult) {
      setError("กรุณาขอ OTP ใหม่")
      return
    }

    setLoading(true)

    try {
      await confirmationResult.confirm(otp)
      
      // Success!
      const verifiedPhone = lockedPhone || phone
      onVerified(verifiedPhone)
      
    } catch (err: any) {
      console.error("Verify OTP error:", err)
      
      if (err.code === "auth/invalid-verification-code") {
        setError("รหัส OTP ไม่ถูกต้อง")
      } else if (err.code === "auth/code-expired") {
        setError("รหัส OTP หมดอายุ กรุณาขอใหม่")
      } else {
        setError("ยืนยัน OTP ไม่สำเร็จ กรุณาลองใหม่")
      }
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOTP = () => {
    setOtp("")
    setConfirmationResult(null)
    recaptchaVerifierRef.current = null
    handleSendOTP()
  }

  // Format phone display
  const formatPhoneDisplay = (p: string) => {
    const cleaned = p.replace(/\D/g, "")
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
    return p
  }

  return (
    <div className="bg-white rounded-xl p-6 max-w-md mx-auto">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>

      {/* reCAPTCHA container (invisible) */}
      <div ref={recaptchaRef} id="recaptcha-container"></div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: INPUT PHONE */}
      {/* ============================================ */}
      {step === "input" && (
        <div className="space-y-4">
          {lockedPhone ? (
            // แสดงเบอร์ที่ล็อคไว้
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เบอร์โทรที่ผูกไว้
              </label>
              <div className="px-4 py-3 bg-gray-100 rounded-lg text-gray-900 font-mono">
                {formatPhoneDisplay(lockedPhone)}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                เบอร์นี้ถูกล็อคไว้แล้ว ไม่สามารถเปลี่ยนได้
              </p>
            </div>
          ) : (
            // ให้กรอกเบอร์ใหม่
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                เบอร์โทรศัพท์
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="0812345678"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-lg"
                maxLength={10}
              />
              <p className="text-xs text-gray-500 mt-1">
                เบอร์นี้จะถูกล็อคสำหรับการถอนเงินครั้งต่อไป
              </p>
            </div>
          )}

          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSendOTP}
              disabled={loading || (!lockedPhone && phone.length !== 10)}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังส่ง...
                </span>
              ) : (
                "ส่ง OTP"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* STEP: VERIFY OTP */}
      {/* ============================================ */}
      {step === "verify" && (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <p className="text-gray-600">
              ส่งรหัส OTP ไปที่เบอร์
            </p>
            <p className="font-mono text-lg font-semibold text-gray-900">
              {formatPhoneDisplay(lockedPhone || phone)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัส OTP (6 หลัก)
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-2xl text-center tracking-widest"
              maxLength={6}
              autoFocus
            />
          </div>

          {/* Resend */}
          <div className="text-center">
            {countdown > 0 ? (
              <p className="text-sm text-gray-500">
                ส่งรหัสใหม่ได้ใน {countdown} วินาที
              </p>
            ) : (
              <button
                onClick={handleResendOTP}
                disabled={loading}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                ส่งรหัส OTP ใหม่
              </button>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => {
                setStep("input")
                setOtp("")
                setError("")
              }}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              ย้อนกลับ
            </button>
            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังยืนยัน...
                </span>
              ) : (
                "ยืนยัน OTP"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}