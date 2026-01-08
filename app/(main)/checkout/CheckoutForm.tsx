"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface CheckoutFormProps {
  plan: {
    id: string
    name: string
    slug: string
    finalPrice: number
    durationMonths: number
    promoExtraMonths: number
  }
  user: {
    id: string
    name: string | null
    email: string | null
  }
  isSignalPlan: boolean
}

export function CheckoutForm({ plan, user, isSignalPlan }: CheckoutFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<'select' | 'qr' | 'success'>('select')
  const [orderData, setOrderData] = useState<any>(null)

  const handlePaymentMethod = async (method: 'QR_CODE' | 'BANK_APP') => {
    setLoading(true)
    setError("")

    try {
      // เลือก API endpoint ตามประเภท plan
      const endpoint = isSignalPlan ? '/api/checkout/signal' : '/api/checkout'
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planSlug: plan.slug,
          paymentMethod: method,
          // ส่งข้อมูลเพิ่มสำหรับ signal plan
          ...(isSignalPlan && {
            months: plan.durationMonths,
            price: plan.finalPrice,
            bonus: plan.promoExtraMonths,
          }),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      setOrderData(data)
      setStep('qr')
      setLoading(false)
    } catch (err) {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  const handleUploadSlip = async (file: File) => {
    if (!orderData) return

    setLoading(true)
    const formData = new FormData()
    formData.append('slip', file)
    formData.append('orderNumber', orderData.orderNumber)
    formData.append('isSignalPlan', String(isSignalPlan))

    try {
      const res = await fetch('/api/upload-slip', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'อัพโหลดไม่สำเร็จ')
        setLoading(false)
        return
      }

      setStep('success')
      setLoading(false)
    } catch (err) {
      setError('อัพโหลดไม่สำเร็จ')
      setLoading(false)
    }
  }

  if (step === 'success') {
    return (
      <div className="card text-center py-8">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">ส่งคำสั่งซื้อสำเร็จ!</h2>
        <p className="text-gray-600 mb-6">
          เรากำลังตรวจสอบการชำระเงินของคุณ<br />
          จะแจ้งให้ทราบภายใน 5-10 นาที
        </p>
        <button
          onClick={() => router.push(isSignalPlan ? '/signals' : '/dashboard')}
          className="btn btn-primary"
        >
          {isSignalPlan ? 'ไปยัง Signal Room' : 'กลับหน้าหลัก'}
        </button>
      </div>
    )
  }

  if (step === 'qr' && orderData) {
    return (
      <div className="card space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">สแกน QR Code เพื่อชำระเงิน</h2>
          <p className="text-gray-600 text-sm">
            Order #{orderData.orderNumber}
          </p>
        </div>

        {/* QR Code */}
        {orderData.qrCodeData && (
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              <img
                src={orderData.qrCodeData}
                alt="QR Code"
                className="w-48 h-48 md:w-64 md:h-64"
              />
            </div>
          </div>
        )}

        {/* Amount */}
        <div className="text-center">
          <p className="text-sm text-gray-600">ยอดชำระ</p>
          <p className="text-3xl font-bold text-emerald-600">
            ฿{(orderData.finalAmount / 100).toLocaleString()}
          </p>
        </div>

        {/* Upload Slip */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <p className="text-sm text-gray-600 text-center mb-3">อัพโหลดสลิปการโอนเงิน</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadSlip(file)
            }}
            className="w-full text-sm"
            disabled={loading}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={() => setStep('select')}
          className="btn btn-outline w-full"
          disabled={loading}
        >
          เลือกวิธีชำระใหม่
        </button>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold text-gray-900 mb-4">เลือกวิธีชำระเงิน</h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* QR Code */}
      <button
        onClick={() => handlePaymentMethod('QR_CODE')}
        disabled={loading}
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left disabled:opacity-50"
      >
        <div className="flex items-center space-x-3">
          <span className="text-3xl">📱</span>
          <div>
            <p className="font-semibold text-gray-900">สแกน QR Code</p>
            <p className="text-sm text-gray-600">PromptPay QR Code</p>
          </div>
        </div>
      </button>

      {/* Bank App */}
      <button
        onClick={() => handlePaymentMethod('BANK_APP')}
        disabled={loading}
        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left disabled:opacity-50"
      >
        <div className="flex items-center space-x-3">
          <span className="text-3xl">🏦</span>
          <div>
            <p className="font-semibold text-gray-900">แอปธนาคาร</p>
            <p className="text-sm text-gray-600">เปิดแอปธนาคารเพื่อชำระ</p>
          </div>
        </div>
      </button>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-2 text-gray-600">กำลังดำเนินการ...</span>
        </div>
      )}

      {/* Note */}
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <p className="text-sm text-blue-800">
          💡 <strong>หมายเหตุ:</strong> หลังชำระเงินแล้ว กรุณาอัพโหลดสลิปเพื่อยืนยัน
        </p>
      </div>
    </div>
  )
}