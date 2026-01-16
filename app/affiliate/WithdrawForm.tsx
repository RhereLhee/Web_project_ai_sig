"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface WithdrawFormProps {
  balance: number // satang
  userId: string
}

type Step = 'form' | 'otp'

export function WithdrawForm({ balance, userId }: WithdrawFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(0)
  
  const [formData, setFormData] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  })
  const [otpCode, setOtpCode] = useState('')

  const maxAmount = balance / 100 // convert to baht
  const minAmount = 350 // บาท

  // ============================================
  // STEP 1: ส่ง OTP
  // ============================================
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate
    const amount = parseFloat(formData.amount)
    if (isNaN(amount) || amount < minAmount) {
      setError(`ขั้นต่ำในการถอนคือ ฿${minAmount}`)
      return
    }
    if (amount > maxAmount) {
      setError('ยอดเงินไม่เพียงพอ')
      return
    }
    if (!formData.bankName || !formData.accountNumber || !formData.accountName) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/withdraw/request-otp', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      // ไปขั้นตอน OTP
      setStep('otp')
      startCountdown(300)

    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // STEP 2: ยืนยัน OTP และถอนเงิน
  // ============================================
  const handleConfirmWithdraw = async () => {
    if (otpCode.length !== 6) {
      setError('กรุณากรอกรหัส OTP 6 หลัก')
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) * 100, // convert to satang
          otpCode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      // สำเร็จ
      alert('ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ 1-3 วันทำการ')
      handleClose()
      router.refresh()

    } catch {
      setError('เกิดข้อผิดพลาด')
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

  const handleClose = () => {
    setOpen(false)
    setStep('form')
    setFormData({ amount: '', bankName: '', accountNumber: '', accountName: '' })
    setOtpCode('')
    setError('')
    setCountdown(0)
  }

  const resendOtp = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch('/api/withdraw/request-otp', {
        method: 'POST',
      })

      if (res.ok) {
        startCountdown(300)
      } else {
        const data = await res.json()
        setError(data.error || 'ส่ง OTP ไม่สำเร็จ')
      }
    } catch {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <>
      <button 
        onClick={() => setOpen(true)} 
        className="btn btn-primary"
        disabled={balance < minAmount * 100}
      >
        💸 ถอนเงิน
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            
            {/* ============================================ */}
            {/* STEP: OTP */}
            {/* ============================================ */}
            {step === 'otp' && (
              <>
                <h2 className="text-lg font-semibold mb-4">📱 ยืนยัน OTP</h2>
                
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-700">
                    เราส่งรหัส OTP ไปที่เบอร์โทรศัพท์ของคุณแล้ว
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">รหัส OTP</label>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="input text-center text-2xl tracking-widest"
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                    />
                  </div>

                  {countdown > 0 && (
                    <p className="text-center text-sm text-gray-500">
                      รหัสหมดอายุใน {formatCountdown(countdown)}
                    </p>
                  )}

                  <button
                    onClick={handleConfirmWithdraw}
                    disabled={loading || otpCode.length !== 6}
                    className="btn btn-primary w-full"
                  >
                    {loading ? 'กำลังดำเนินการ...' : 'ยืนยันถอนเงิน'}
                  </button>

                  <button
                    onClick={resendOtp}
                    disabled={loading || countdown > 0}
                    className="btn btn-outline w-full"
                  >
                    ส่งรหัสอีกครั้ง
                  </button>

                  <button
                    onClick={() => {
                      setStep('form')
                      setOtpCode('')
                      setError('')
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 w-full text-center"
                  >
                    ← ย้อนกลับ
                  </button>
                </div>
              </>
            )}

            {/* ============================================ */}
            {/* STEP: FORM */}
            {/* ============================================ */}
            {step === 'form' && (
              <>
                <h2 className="text-lg font-semibold mb-4">💸 ถอนเงิน</h2>
                
                <div className="bg-emerald-50 rounded-lg p-3 mb-4">
                  <p className="text-sm text-emerald-600">ยอดที่ถอนได้</p>
                  <p className="text-2xl font-bold text-emerald-700">฿{maxAmount.toLocaleString()}</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm mb-4">
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">จำนวนเงิน (บาท)</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="input"
                      max={maxAmount}
                      min={minAmount}
                      placeholder={`ขั้นต่ำ ฿${minAmount}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">ธนาคาร</label>
                    <select
                      value={formData.bankName}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="input"
                      required
                    >
                      <option value="">เลือกธนาคาร</option>
                      <option value="กสิกรไทย">กสิกรไทย</option>
                      <option value="ไทยพาณิชย์">ไทยพาณิชย์</option>
                      <option value="กรุงเทพ">กรุงเทพ</option>
                      <option value="กรุงไทย">กรุงไทย</option>
                      <option value="ทหารไทยธนชาต">ทหารไทยธนชาต</option>
                      <option value="ออมสิน">ออมสิน</option>
                      <option value="PromptPay">PromptPay</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">เลขบัญชี</label>
                    <input
                      type="text"
                      value={formData.accountNumber}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="input"
                      placeholder="เลขบัญชีหรือเบอร์ PromptPay"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">ชื่อบัญชี</label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      className="input"
                      placeholder="ชื่อ-นามสกุล"
                      required
                    />
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <p className="text-xs text-yellow-700">
                      ⚠️ ระบบจะส่ง SMS OTP ไปยังเบอร์โทรศัพท์ที่ลงทะเบียนไว้<br />
                      กรุณาตรวจสอบให้แน่ใจว่าเบอร์โทรถูกต้อง
                    </p>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <button 
                      type="button" 
                      onClick={handleClose} 
                      className="btn btn-outline flex-1"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="submit" 
                      disabled={loading} 
                      className="btn btn-primary flex-1"
                    >
                      {loading ? 'กำลังส่ง OTP...' : 'ขอรหัส OTP'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}