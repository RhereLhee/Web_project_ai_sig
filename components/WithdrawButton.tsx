"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { auth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "@/lib/firebase"

interface WithdrawButtonProps {
  balance: number // satang
  bankInfo: {
    bankName: string
    accountNumber: string
    accountName: string
  }
  lockedPhone?: string | null // เบอร์ที่ล็อคไว้แล้ว
}

type Step = 'form' | 'otp' | 'confirm' | 'success'

const BANKS = [
  { code: 'KBANK', name: 'กสิกรไทย' },
  { code: 'SCB', name: 'ไทยพาณิชย์' },
  { code: 'BBL', name: 'กรุงเทพ' },
  { code: 'KTB', name: 'กรุงไทย' },
  { code: 'TMB', name: 'ทหารไทยธนชาต' },
  { code: 'GSB', name: 'ออมสิน' },
  { code: 'BAY', name: 'กรุงศรี' },
]

export function WithdrawButton({ balance, bankInfo, lockedPhone }: WithdrawButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form data
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState(lockedPhone || '')
  const [bankCode, setBankCode] = useState(bankInfo.bankName || '')
  const [accountNumber, setAccountNumber] = useState(bankInfo.accountNumber || '')
  const [accountName, setAccountName] = useState(bankInfo.accountName || '')

  // OTP
  const [otp, setOtp] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

  const recaptchaRef = useRef<HTMLDivElement>(null)
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null)

  const maxAmount = balance / 100
  const canWithdraw = maxAmount >= 100

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // Reset on close
  const handleClose = () => {
    setOpen(false)
    setStep('form')
    setError('')
    setOtp('')
    setConfirmationResult(null)
    recaptchaVerifierRef.current = null
  }

  // Format phone for Firebase (+66)
  const formatPhoneToE164 = (p: string) => {
    const cleaned = p.replace(/[\s\-]/g, '')
    if (cleaned.startsWith('0')) {
      return '+66' + cleaned.slice(1)
    }
    return cleaned
  }

  // Format phone display
  const formatPhoneDisplay = (p: string) => {
    const cleaned = p.replace(/\D/g, '')
    if (cleaned.length >= 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
    }
    return p
  }

  // Initialize reCAPTCHA
  const initRecaptcha = () => {
    if (!recaptchaVerifierRef.current && recaptchaRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: 'invisible',
        callback: () => {},
        'expired-callback': () => {
          setError('reCAPTCHA หมดอายุ กรุณาลองใหม่')
          recaptchaVerifierRef.current = null
        },
      })
    }
  }

  // Step 1: Validate form and send OTP
  const handleFormSubmit = async () => {
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
    const phoneToUse = lockedPhone || phone
    if (!phoneToUse || phoneToUse.length !== 10) {
      setError('กรุณาระบุเบอร์โทร 10 หลัก')
      return
    }
    if (!phoneToUse.startsWith('0') || !['6', '8', '9'].includes(phoneToUse[1])) {
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

    // Send OTP
    setLoading(true)
    try {
      initRecaptcha()
      
      if (!recaptchaVerifierRef.current) {
        throw new Error('ไม่สามารถสร้าง reCAPTCHA ได้')
      }

      const phoneE164 = formatPhoneToE164(phoneToUse)
      const result = await signInWithPhoneNumber(auth, phoneE164, recaptchaVerifierRef.current)
      
      setConfirmationResult(result)
      setStep('otp')
      setCountdown(60)
    } catch (err: any) {
      console.error('Send OTP error:', err)
      recaptchaVerifierRef.current = null
      
      if (err.code === 'auth/too-many-requests') {
        setError('ส่ง OTP บ่อยเกินไป กรุณารอสักครู่')
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('เบอร์โทรไม่ถูกต้อง')
      } else {
        setError('ไม่สามารถส่ง OTP ได้ กรุณาลองใหม่')
      }
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP
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
    setConfirmationResult(null)
    recaptchaVerifierRef.current = null
    handleFormSubmit()
  }

  // Step 3: Confirm withdrawal
  const handleConfirm = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/withdrawal/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          phone: lockedPhone || phone,
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
                {step === 'otp' && 'ยืนยัน OTP'}
                {step === 'confirm' && 'ยืนยันการถอน'}
                {step === 'success' && 'สำเร็จ'}
              </h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* reCAPTCHA container */}
            <div ref={recaptchaRef} id="recaptcha-container"></div>

            <div className="p-4">
              {/* Error */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      จำนวนเงินที่ต้องการถอน (บาท)
                    </label>
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
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      เบอร์โทรศัพท์
                    </label>
                    {lockedPhone ? (
                      <div className="px-4 py-3 bg-gray-100 rounded-lg text-gray-700 font-mono">
                        {formatPhoneDisplay(lockedPhone)}
                        <span className="text-xs text-gray-500 ml-2">(ล็อคแล้ว)</span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                          placeholder="0812345678"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                          maxLength={10}
                        />
                        <p className="text-xs text-orange-600 mt-1">
                          เบอร์นี้จะถูกล็อคถาวรสำหรับการถอนเงินครั้งต่อไป
                        </p>
                      </>
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
                      disabled={loading}
                      className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'กำลังส่ง...' : 'ถัดไป'}
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
                      onClick={() => {
                        setStep('form')
                        setOtp('')
                        setError('')
                      }}
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
                      <span className="font-mono">{formatPhoneDisplay(lockedPhone || phone)}</span>
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