"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "@/lib/firebase"

// ============================================
// DEV MODE: ตั้งเป็น false เพื่อใช้ OTP จริง
// ============================================
const DEV_SKIP_OTP = false  // true = ข้าม OTP, false = ใช้ OTP จริง

interface WithdrawButtonProps {
  balance: number // satang
  bankInfo: {
    bankName: string
    accountNumber: string
    accountName: string
  }
  userPhone?: string | null
  lockedPhone?: string | null
}

type Step = 'form' | 'recaptcha' | 'otp' | 'confirm' | 'success'

const BANKS = [
  { code: 'KBANK', name: 'กสิกรไทย' },
  { code: 'SCB', name: 'ไทยพาณิชย์' },
  { code: 'BBL', name: 'กรุงเทพ' },
  { code: 'KTB', name: 'กรุงไทย' },
  { code: 'TMB', name: 'ทหารไทยธนชาต' },
  { code: 'GSB', name: 'ออมสิน' },
  { code: 'BAY', name: 'กรุงศรี' },
]

export function WithdrawButton({ balance, bankInfo, userPhone, lockedPhone }: WithdrawButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form data
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState(lockedPhone || userPhone || '')
  const [bankCode, setBankCode] = useState(bankInfo.bankName || '')
  const [accountNumber, setAccountNumber] = useState(bankInfo.accountNumber || '')
  const [accountName, setAccountName] = useState(bankInfo.accountName || '')

  // OTP & reCAPTCHA
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)
  const [recaptchaReady, setRecaptchaReady] = useState(false)
  const [recaptchaSolved, setRecaptchaSolved] = useState(false)

  const recaptchaRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  const maxAmount = balance / 100
  const canWithdraw = maxAmount >= 100

  const phoneToUse = lockedPhone || phone
  const isPhoneLocked = !!lockedPhone

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Clear reCAPTCHA
  const clearRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear()
      } catch (e) {
        console.log('reCAPTCHA clear warning:', e)
      }
      recaptchaVerifierRef.current = null
    }
    if (recaptchaRef.current) {
      recaptchaRef.current.innerHTML = ''
    }
    setRecaptchaReady(false)
    setRecaptchaSolved(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearRecaptcha()
    }
  }, [clearRecaptcha])

  // Initialize reCAPTCHA เมื่อเข้า step recaptcha
  useEffect(() => {
    if (step === 'recaptcha' && recaptchaRef.current && !recaptchaVerifierRef.current) {
      console.log('=== Initializing reCAPTCHA (visible mode) ===')
      
      try {
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
          size: 'normal', // ใช้ visible mode แทน invisible
          callback: (response: string) => {
            console.log('reCAPTCHA solved:', response)
            setRecaptchaSolved(true)
            setError('')
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired')
            setRecaptchaSolved(false)
            setError('reCAPTCHA หมดอายุ กรุณากดยืนยันใหม่')
          },
        })

        recaptchaVerifierRef.current.render().then((widgetId) => {
          console.log('reCAPTCHA rendered, widgetId:', widgetId)
          setRecaptchaReady(true)
        }).catch((err) => {
          console.error('reCAPTCHA render error:', err)
          setError(`ไม่สามารถโหลด reCAPTCHA: ${err.message}`)
        })
      } catch (err: any) {
        console.error('reCAPTCHA init error:', err)
        setError(`เกิดข้อผิดพลาด: ${err.message}`)
      }
    }
  }, [step])

  // Reset on close
  const handleClose = () => {
    setOpen(false)
    setStep('form')
    setError('')
    setOtp('')
    setConfirmationResult(null)
    clearRecaptcha()
  }

  // Format phone for Firebase (+66)
  const formatPhoneToE164 = (p: string) => {
    const cleaned = p.replace(/[\s\-]/g, '')
    if (cleaned.startsWith('0')) {
      return '+66' + cleaned.slice(1)
    }
    if (cleaned.startsWith('66')) {
      return '+' + cleaned
    }
    return cleaned
  }

  // Format phone display
  const formatPhoneDisplay = (p: string) => {
    if (!p) return ''
    let cleaned = p.replace(/\D/g, '')
    if (cleaned.startsWith('66')) {
      cleaned = '0' + cleaned.slice(2)
    }
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
    return cleaned
  }

  // Step 1: Validate form แล้วไป step reCAPTCHA
  const handleFormSubmit = () => {
    setError('')

    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('กรุณาระบุจำนวนเงิน')
      return
    }
    if (amountNum < 100) {
      setError('ถอนขั้นต่ำ 100 บาท')
      return
    }
    if (amountNum > maxAmount) {
      setError('ยอดเงินไม่เพียงพอ')
      return
    }

    // Validate phone
    let phoneForValidation = phoneToUse
    if (phoneForValidation.startsWith('66')) {
      phoneForValidation = '0' + phoneForValidation.slice(2)
    }
    
    if (!phoneForValidation || phoneForValidation.length !== 10) {
      setError('กรุณาระบุเบอร์โทร 10 หลัก')
      return
    }
    if (!phoneForValidation.startsWith('0') || !['6', '8', '9'].includes(phoneForValidation[1])) {
      setError('เบอร์โทรต้องขึ้นต้นด้วย 06, 08 หรือ 09')
      return
    }

    // Validate bank
    if (!bankCode) {
      setError('กรุณาเลือกธนาคาร')
      return
    }
    if (!accountNumber || accountNumber.length < 10) {
      setError('กรุณาระบุเลขบัญชีที่ถูกต้อง')
      return
    }
    if (!accountName || accountName.length < 2) {
      setError('กรุณาระบุชื่อบัญชี')
      return
    }

    // ============================================
    // DEV MODE: ข้าม OTP ไปหน้า confirm เลย
    // ============================================
    if (DEV_SKIP_OTP) {
      console.log('DEV MODE: Skipping OTP verification')
      setStep('confirm')
      return
    }

    // ไป step reCAPTCHA
    clearRecaptcha()
    setStep('recaptcha')
  }

  // Step 2: ส่ง OTP หลังจาก reCAPTCHA solved
  const handleSendOTP = async () => {
    if (!recaptchaSolved || !recaptchaVerifierRef.current) {
      setError('กรุณากดยืนยัน reCAPTCHA ก่อน')
      return
    }

    setLoading(true)
    setError('')

    try {
      const phoneE164 = formatPhoneToE164(phoneToUse)
      console.log('=== Sending OTP ===')
      console.log('Phone:', phoneE164)

      const result = await signInWithPhoneNumber(auth, phoneE164, recaptchaVerifierRef.current)
      
      console.log('OTP sent successfully!')
      setConfirmationResult(result)
      setStep('otp')
      setCountdown(60)
    } catch (err: any) {
      console.error('Send OTP error:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)
      
      // Reset reCAPTCHA on error
      clearRecaptcha()
      
      if (err.code === 'auth/too-many-requests') {
        setError('ส่ง OTP บ่อยเกินไป กรุณารอ 1 ชั่วโมง')
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('เบอร์โทรไม่ถูกต้อง')
      } else if (err.code === 'auth/quota-exceeded') {
        setError('ระบบส่ง SMS เต็มโควต้าแล้ว กรุณาลองใหม่พรุ่งนี้')
      } else if (err.code === 'auth/invalid-app-credential') {
        setError('การยืนยันตัวตนล้มเหลว กรุณารีเฟรชหน้าแล้วลองใหม่')
      } else {
        setError(`ไม่สามารถส่ง OTP ได้: ${err.message}`)
      }
      
      // กลับไป step recaptcha ให้ลองใหม่
      setTimeout(() => {
        setStep('recaptcha')
      }, 100)
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Verify OTP
  const handleVerifyOTP = async () => {
    setError('')

    if (otp.length !== 6) {
      setError('รหัส OTP ต้องมี 6 หลัก')
      return
    }

    if (!confirmationResult) {
      setError('กรุณาขอ OTP ใหม่')
      return
    }

    setLoading(true)
    try {
      await confirmationResult.confirm(otp)
      setStep('confirm')
    } catch (err: any) {
      console.error('Verify OTP error:', err)
      
      if (err.code === 'auth/invalid-verification-code') {
        setError('รหัส OTP ไม่ถูกต้อง')
      } else if (err.code === 'auth/code-expired') {
        setError('รหัส OTP หมดอายุ กรุณาขอใหม่')
      } else {
        setError('ยืนยัน OTP ไม่สำเร็จ กรุณาลองใหม่')
      }
    } finally {
      setLoading(false)
    }
  }

  // Resend OTP
  const handleResendOTP = () => {
    setOtp('')
    setError('')
    setConfirmationResult(null)
    clearRecaptcha()
    setStep('recaptcha')
  }

  // Step 4: Confirm withdrawal
  const handleConfirm = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/withdraw/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          phone: phoneToUse,
          bankCode,
          accountNumber,
          accountName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'ไม่สามารถสร้างคำขอถอนเงินได้')
        setLoading(false)
        return
      }

      setStep('success')
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  if (!canWithdraw) {
    return (
      <button disabled className="w-full py-3 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed">
        ถอนขั้นต่ำ ฿100
      </button>
    )
  }

  return (
    <>
      <button 
        onClick={() => setOpen(true)} 
        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
      >
        ถอนเงิน
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {step === 'form' && 'ถอนเงิน'}
                {step === 'recaptcha' && 'ยืนยันตัวตน'}
                {step === 'otp' && 'ยืนยัน OTP'}
                {step === 'confirm' && 'ยืนยันการถอน'}
                {step === 'success' && 'สำเร็จ'}
              </h2>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm whitespace-pre-wrap">
                  {error}
                </div>
              )}

              {/* ============================================ */}
              {/* STEP: FORM */}
              {/* ============================================ */}
              {step === 'form' && (
                <div className="space-y-4">
                  {/* Balance */}
                  <div className="bg-emerald-50 rounded-lg p-4">
                    <p className="text-sm text-emerald-600">ยอดที่ถอนได้</p>
                    <p className="text-2xl font-bold text-emerald-700">฿{maxAmount.toLocaleString()}</p>
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงิน (บาท)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="ขั้นต่ำ 100 บาท"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      min={100}
                      max={maxAmount}
                    />
                  </div>

                  {/* Quick amounts */}
                  <div className="flex space-x-2">
                    {[100, 500, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmount(Math.min(val, maxAmount).toString())}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        disabled={val > maxAmount}
                      >
                        ฿{val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAmount(maxAmount.toString())}
                      className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      ทั้งหมด
                    </button>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ (รับ OTP)</label>
                    {isPhoneLocked ? (
                      <div>
                        <div className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 font-mono">
                          {formatPhoneDisplay(phoneToUse)}
                        </div>
                        <p className="text-xs text-yellow-600 mt-1">เบอร์ถูกล็อคจากการถอนครั้งก่อน</p>
                      </div>
                    ) : (
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="0812345678"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                        maxLength={10}
                      />
                    )}
                  </div>

                  {/* Bank */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ธนาคาร</label>
                    <select
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      <option value="">เลือกธนาคาร</option>
                      {BANKS.map((bank) => (
                        <option key={bank.code} value={bank.name}>{bank.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                      placeholder="1234567890"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                      maxLength={15}
                    />
                  </div>

                  {/* Account Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี</label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="นาย สมชาย ใจดี"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  {/* Submit */}
                  <div className="flex space-x-3 pt-2">
                    <button
                      onClick={handleClose}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleFormSubmit}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* STEP: RECAPTCHA */}
              {/* ============================================ */}
              {step === 'recaptcha' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-gray-600">กรุณายืนยันว่าคุณไม่ใช่บอท</p>
                    <p className="text-sm text-gray-500 mt-1">
                      จะส่ง OTP ไปที่ <span className="font-mono font-semibold">{formatPhoneDisplay(phoneToUse)}</span>
                    </p>
                  </div>

                  {/* reCAPTCHA container */}
                  <div className="flex justify-center py-4">
                    <div ref={recaptchaRef} id="recaptcha-container" />
                  </div>

                  {!recaptchaReady && !error && (
                    <div className="text-center text-gray-500 text-sm">
                      กำลังโหลด reCAPTCHA...
                    </div>
                  )}

                  {recaptchaSolved && (
                    <div className="text-center text-emerald-600 text-sm font-medium">
                      ยืนยันสำเร็จ!
                    </div>
                  )}

                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        clearRecaptcha()
                        setStep('form')
                      }}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      onClick={handleSendOTP}
                      disabled={!recaptchaSolved || loading}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? 'กำลังส่ง OTP...' : 'ส่ง OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* STEP: OTP */}
              {/* ============================================ */}
              {step === 'otp' && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <p className="text-gray-600">ส่งรหัส OTP ไปที่เบอร์</p>
                    <p className="font-mono text-lg font-semibold text-gray-900">
                      {formatPhoneDisplay(phoneToUse)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      รหัส OTP (6 หลัก)
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-2xl text-center tracking-widest"
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  {/* Resend */}
                  <div className="text-center">
                    {countdown > 0 ? (
                      <p className="text-sm text-gray-500">ส่งรหัสใหม่ได้ใน {countdown} วินาที</p>
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
                      onClick={handleResendOTP}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      ย้อนกลับ
                    </button>
                    <button
                      onClick={handleVerifyOTP}
                      disabled={loading || otp.length !== 6}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'กำลังยืนยัน...' : 'ยืนยัน OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* STEP: CONFIRM */}
              {/* ============================================ */}
              {step === 'confirm' && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">จำนวนเงิน</span>
                      <span className="font-bold text-emerald-600">฿{parseFloat(amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">ธนาคาร</span>
                      <span>{bankCode}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">เลขบัญชี</span>
                      <span className="font-mono">{accountNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">ชื่อบัญชี</span>
                      <span>{accountName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">เบอร์โทร</span>
                      <span className="font-mono">{formatPhoneDisplay(phoneToUse)}</span>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-700">
                      กรุณาตรวจสอบข้อมูลให้ถูกต้อง หากข้อมูลผิดพลาดอาจทำให้ไม่ได้รับเงิน
                    </p>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => setStep('form')}
                      className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={loading}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'กำลังดำเนินการ...' : 'ยืนยันถอนเงิน'}
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================ */}
              {/* STEP: SUCCESS */}
              {/* ============================================ */}
              {step === 'success' && (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">ส่งคำขอถอนเงินสำเร็จ</h3>
                  <p className="text-gray-600 mb-6">
                    รอ Admin อนุมัติและโอนเงิน<br />
                    <span className="text-emerald-600 font-medium">ภายใน 1-3 วันทำการ</span>
                  </p>

                  <button
                    onClick={() => {
                      handleClose()
                      router.refresh()
                    }}
                    className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
                  >
                    กลับหน้าหลัก
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}