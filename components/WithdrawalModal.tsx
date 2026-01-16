"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { PhoneOTPVerification } from "@/components/PhoneOTPVerification"
import { THAI_BANKS } from "@/lib/validators"

interface WithdrawalModalProps {
  onClose: () => void
}

type Step = "loading" | "form" | "otp" | "confirm" | "success"

interface WithdrawalInfo {
  balance: number
  minWithdraw: number
  hasLockedPhone: boolean
  lockedPhone: string | null
  partner: {
    bankName?: string
    accountNumber?: string
    accountName?: string
  } | null
}

export function WithdrawalModal({ onClose }: WithdrawalModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("loading")
  const [info, setInfo] = useState<WithdrawalInfo | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // Form data
  const [amount, setAmount] = useState("")
  const [phone, setPhone] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [accountName, setAccountName] = useState("")

  // Verified phone from OTP
  const [verifiedPhone, setVerifiedPhone] = useState("")

  // Load withdrawal info
  useEffect(() => {
    loadInfo()
  }, [])

  const loadInfo = async () => {
    try {
      const res = await fetch("/api/withdrawal/request")
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "ไม่สามารถโหลดข้อมูลได้")
        return
      }

      setInfo(data)

      // Pre-fill form if has data
      if (data.partner) {
        if (data.partner.bankName) setBankCode(data.partner.bankName)
        if (data.partner.accountNumber) setAccountNumber(data.partner.accountNumber)
        if (data.partner.accountName) setAccountName(data.partner.accountName)
      }
      if (data.lockedPhone) {
        setPhone(data.lockedPhone)
      }

      setStep("form")
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล")
    }
  }

  // Handle form submit → go to OTP
  const handleFormSubmit = () => {
    setError("")

    // Validate amount
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("กรุณาระบุจำนวนเงิน")
      return
    }
    if (info && amountNum < info.minWithdraw) {
      setError(`ถอนขั้นต่ำ ${info.minWithdraw} บาท`)
      return
    }
    if (info && amountNum > info.balance) {
      setError("ยอดเงินไม่เพียงพอ")
      return
    }

    // Validate phone
    if (!info?.hasLockedPhone && phone.length !== 10) {
      setError("กรุณาระบุเบอร์โทร 10 หลัก")
      return
    }

    // Validate bank
    if (!bankCode) {
      setError("กรุณาเลือกธนาคาร")
      return
    }
    if (!accountNumber || accountNumber.length < 10) {
      setError("กรุณาระบุเลขบัญชีที่ถูกต้อง")
      return
    }
    if (!accountName || accountName.length < 2) {
      setError("กรุณาระบุชื่อบัญชี")
      return
    }

    // Go to OTP step
    setStep("otp")
  }

  // Handle OTP verified
  const handleOTPVerified = (verifiedPhoneNumber: string) => {
    setVerifiedPhone(verifiedPhoneNumber)
    setStep("confirm")
  }

  // Handle confirm withdrawal
  const handleConfirm = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/withdrawal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          phone: verifiedPhone || phone,
          bankCode,
          accountNumber,
          accountName,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "ไม่สามารถสร้างคำขอถอนเงินได้")
        setLoading(false)
        return
      }

      setStep("success")
    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === "loading" && "กำลังโหลด..."}
            {step === "form" && "ถอนเงิน"}
            {step === "otp" && "ยืนยันตัวตน"}
            {step === "confirm" && "ยืนยันการถอน"}
            {step === "success" && "สำเร็จ"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* ============================================ */}
          {/* STEP: LOADING */}
          {/* ============================================ */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500">กำลังโหลด...</p>
            </div>
          )}

          {/* ============================================ */}
          {/* STEP: FORM */}
          {/* ============================================ */}
          {step === "form" && info && (
            <div className="space-y-4">
              {/* Balance */}
              <div className="bg-emerald-50 rounded-lg p-4">
                <p className="text-sm text-emerald-600">ยอดคงเหลือ</p>
                <p className="text-2xl font-bold text-emerald-700">
                  ฿{info.balance.toLocaleString()}
                </p>
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
                  placeholder={`ขั้นต่ำ ${info.minWithdraw} บาท`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  min={info.minWithdraw}
                  max={info.balance}
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เบอร์โทรศัพท์
                </label>
                {info.hasLockedPhone ? (
                  <div className="px-4 py-3 bg-gray-100 rounded-lg text-gray-700 font-mono">
                    {formatPhoneDisplay(info.lockedPhone!)}
                    <span className="text-xs text-gray-500 ml-2">(ล็อคแล้ว)</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ธนาคาร
                </label>
                <select
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">เลือกธนาคาร</option>
                  {THAI_BANKS.map((bank) => (
                    <option key={bank.code} value={bank.code}>
                      {bank.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เลขบัญชี
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 15))}
                  placeholder="1234567890"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                  maxLength={15}
                />
              </div>

              {/* Account Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อบัญชี
                </label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="นาย สมชาย ใจดี"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Submit */}
              <button
                onClick={handleFormSubmit}
                className="w-full py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors"
              >
                ถัดไป
              </button>
            </div>
          )}

          {/* ============================================ */}
          {/* STEP: OTP */}
          {/* ============================================ */}
          {step === "otp" && (
            <PhoneOTPVerification
              lockedPhone={info?.lockedPhone || null}
              onVerified={handleOTPVerified}
              onCancel={() => setStep("form")}
              title="ยืนยันเบอร์โทรเพื่อถอนเงิน"
            />
          )}

          {/* ============================================ */}
          {/* STEP: CONFIRM */}
          {/* ============================================ */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">จำนวนเงิน</span>
                  <span className="font-bold text-emerald-600">฿{parseFloat(amount).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ธนาคาร</span>
                  <span>{THAI_BANKS.find(b => b.code === bankCode)?.name}</span>
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
                  <span className="font-mono">{formatPhoneDisplay(verifiedPhone || phone)}</span>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-700">
                  กรุณาตรวจสอบข้อมูลให้ถูกต้อง หากข้อมูลผิดพลาดอาจทำให้ไม่ได้รับเงิน
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep("form")}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  แก้ไข
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                  {loading ? "กำลังดำเนินการ..." : "ยืนยันถอนเงิน"}
                </button>
              </div>
            </div>
          )}

          {/* ============================================ */}
          {/* STEP: SUCCESS */}
          {/* ============================================ */}
          {step === "success" && (
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
                  onClose()
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
  )
}