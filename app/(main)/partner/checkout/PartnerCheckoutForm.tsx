"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface PartnerCheckoutFormProps {
  userId: string
  months: number
  bonus: number
  price: number
}

const BANKS = [
  { code: 'KBANK', name: 'กสิกรไทย' },
  { code: 'SCB', name: 'ไทยพาณิชย์' },
  { code: 'BBL', name: 'กรุงเทพ' },
  { code: 'KTB', name: 'กรุงไทย' },
  { code: 'TMB', name: 'ทหารไทยธนชาต' },
  { code: 'GSB', name: 'ออมสิน' },
  { code: 'BAY', name: 'กรุงศรี' },
]

type Step = 'terms' | 'info' | 'payment' | 'upload' | 'success'

interface OrderData {
  orderNumber: string
  orderId: string
  finalPrice: number
  qrCodeData: string
  promptPayId: string
}

export function PartnerCheckoutForm({ userId, months, bonus, price }: PartnerCheckoutFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('terms')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
  })
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  // ============================================
  // Step 1: อ่านเงื่อนไข
  // ============================================
  if (step === 'terms') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">เงื่อนไข Partner Reward</h2>
        
        <div className="space-y-5 mb-6 max-h-96 overflow-y-auto text-sm text-gray-600">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">คุณสมบัติในการรับ Partner Reward</h3>
            <ul className="space-y-1.5">
              <li>• ผู้ใช้ต้องมี Signal Subscription อยู่ในสถานะใช้งาน (Active)</li>
              <li>• ผู้ใช้ต้องมี Partner Plan อยู่ในสถานะใช้งาน (Active)</li>
              <li>• ทั้งสองสถานะต้องอยู่ในช่วง Active ภายในรอบเดือนที่มีการขอถอนผลตอบแทน</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">การคำนวณและการถอนผลตอบแทน</h3>
            <ul className="space-y-1.5">
              <li>• ผลตอบแทนคำนวณจากการใช้งานจริงของผู้ใช้บริการที่ถูกแนะนำ</li>
              <li>• ระบบจะทำการสรุปยอดผลตอบแทนเป็นรายเดือน</li>
              <li>• ยอดถอนขั้นต่ำ ฿100 ต่อครั้ง</li>
              <li>• การดำเนินการถอนใช้ระยะเวลาไม่เกิน 3 วันทำการ</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">เงื่อนไขและข้อจำกัด</h3>
            <ul className="space-y-1.5">
              <li>• ระบบไม่มีการรับประกันหรือการการันตีรายได้ใดๆ</li>
              <li>• ผลตอบแทนขึ้นอยู่กับการใช้งานจริงของผู้ใช้บริการ</li>
              <li>• Partner Reward เป็นผลตอบแทนจากการแนะนำการใช้งานบริการ</li>
            </ul>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-700">
              ระบบนี้ไม่ได้ให้ผลตอบแทนจากการชักชวนสมัครเพียงอย่างเดียว แต่ให้ผลตอบแทนจากการใช้งานบริการจริงของผู้ใช้ที่ถูกแนะนำ
            </p>
          </div>
        </div>

        <label className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span className="text-sm text-gray-700">
            ข้าพเจ้าได้อ่านและยอมรับเงื่อนไข Partner Reward ทั้งหมดแล้ว
          </span>
        </label>

        <button
          onClick={() => setStep('info')}
          disabled={!acceptedTerms}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          ยอมรับและดำเนินการต่อ
        </button>
      </div>
    )
  }

  // ============================================
  // Step 2: กรอกข้อมูลธนาคาร
  // ============================================
  if (step === 'info') {
    const handleInfoSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setError('')
      setLoading(true)

      // Validate
      if (!formData.bankName) {
        setError('กรุณาเลือกธนาคาร')
        setLoading(false)
        return
      }
      if (!formData.accountNumber || formData.accountNumber.length < 10) {
        setError('กรุณาระบุเลขบัญชีที่ถูกต้อง (10-15 หลัก)')
        setLoading(false)
        return
      }
      if (!formData.accountName || formData.accountName.length < 2) {
        setError('กรุณาระบุชื่อบัญชี')
        setLoading(false)
        return
      }

      try {
        // เรียก API สร้าง Order + QR Code
        const res = await fetch('/api/partner/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            months,
            bonus,
            ...formData,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'เกิดข้อผิดพลาด')
          setLoading(false)
          return
        }

        setOrderData({
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          finalPrice: data.finalPrice,
          qrCodeData: data.qrCodeData,
          promptPayId: data.promptPayId,
        })
        setStep('payment')
      } catch {
        setError('เกิดข้อผิดพลาดในการสร้างออเดอร์')
      } finally {
        setLoading(false)
      }
    }

    return (
      <form onSubmit={handleInfoSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">ข้อมูลบัญชีรับเงิน</h2>
        <p className="text-sm text-gray-500 mb-4">ใช้สำหรับรับ Partner Reward</p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ธนาคาร</label>
            <select
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              required
            >
              <option value="">เลือกธนาคาร</option>
              {BANKS.map((bank) => (
                <option key={bank.code} value={bank.name}>{bank.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี</label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 15) })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
              placeholder="1234567890"
              maxLength={15}
              required
            />
            <p className="text-xs text-gray-400 mt-1">เลขบัญชี 10-15 หลัก</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี</label>
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="ชื่อ-นามสกุล ตามบัญชี"
              required
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            type="button"
            onClick={() => setStep('terms')}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            ย้อนกลับ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
          >
            {loading ? 'กำลังสร้างออเดอร์...' : 'ถัดไป'}
          </button>
        </div>
      </form>
    )
  }

  // ============================================
  // Step 3: ชำระเงิน - แสดง QR Code
  // ============================================
  if (step === 'payment' && orderData) {
    const formatPromptPayId = (id: string) => {
      if (id.length === 10) {
        return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`
      }
      return id
    }

    return (
      <div className="space-y-4">
        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">สรุปรายการ</h2>
          
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">Order #</span>
              <span className="font-mono text-gray-900">{orderData.orderNumber}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">แพ็กเกจ</span>
              <span className="text-gray-900">{months} เดือน {bonus > 0 && `(+${bonus} ฟรี)`}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">ระยะเวลาใช้งาน</span>
              <span className="text-gray-900">{months + bonus} เดือน</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">บัญชีรับเงิน</span>
              <span className="text-gray-900">{formData.bankName} - {formData.accountNumber.slice(-4)}</span>
            </div>
            <div className="flex justify-between py-2 font-semibold">
              <span className="text-gray-900">ยอดชำระ</span>
              <span className="text-emerald-600">฿{orderData.finalPrice.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* QR Code Payment */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">ชำระเงิน</h2>
          
          {/* QR Code */}
          <div className="text-center mb-4">
            {orderData.qrCodeData ? (
              <div className="inline-block bg-white p-3 rounded-lg border-2 border-gray-200">
                <img
                  src={orderData.qrCodeData}
                  alt="PromptPay QR Code"
                  className="w-48 h-48 md:w-56 md:h-56"
                />
              </div>
            ) : (
              <div className="inline-block bg-gray-100 p-8 rounded-lg">
                <p className="text-gray-500">ไม่สามารถสร้าง QR ได้</p>
              </div>
            )}
          </div>

          {/* PromptPay Info */}
          <div className="bg-blue-50 rounded-lg p-3 text-center mb-4">
            <p className="text-xs text-blue-600 mb-1">หรือโอนเงินไปที่ PromptPay</p>
            <p className="text-lg font-bold text-blue-700">
              {formatPromptPayId(orderData.promptPayId)}
            </p>
          </div>

          {/* Amount */}
          <div className="text-center py-2 mb-4">
            <p className="text-sm text-gray-500">ยอดชำระ</p>
            <p className="text-3xl font-bold text-emerald-600">
              ฿{orderData.finalPrice.toLocaleString()}
            </p>
          </div>

          {/* Next Button */}
          <button
            onClick={() => setStep('upload')}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors"
          >
            ชำระเงินแล้ว → ส่งหลักฐาน
          </button>

          <p className="text-xs text-gray-400 text-center mt-2">
            หลังโอนเงินแล้ว กดปุ่มด้านบนเพื่อส่งสลิป
          </p>
        </div>
      </div>
    )
  }

  // ============================================
  // Step 4: อัพโหลด Slip
  // ============================================
  if (step === 'upload' && orderData) {
    const handleUploadSlip = async (file: File) => {
      setUploading(true)
      setError('')

      const formDataUpload = new FormData()
      formDataUpload.append('slip', file)
      formDataUpload.append('orderNumber', orderData.orderNumber)

      try {
        const res = await fetch('/api/upload-slip', {
          method: 'POST',
          body: formDataUpload,
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'อัพโหลดไม่สำเร็จ')
          setUploading(false)
          return
        }

        setStep('success')
      } catch {
        setError('เกิดข้อผิดพลาดในการอัพโหลด')
      } finally {
        setUploading(false)
      }
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ส่งหลักฐานการชำระเงิน</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order #</span>
            <span className="font-mono font-medium">{orderData.orderNumber}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">ยอดชำระ</span>
            <span className="font-bold text-emerald-600">฿{orderData.finalPrice.toLocaleString()}</span>
          </div>
        </div>

        {/* Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-gray-600 mb-3">อัพโหลดสลิปการโอนเงิน</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUploadSlip(file)
            }}
            className="hidden"
            id="slip-upload"
            disabled={uploading}
          />
          <label
            htmlFor="slip-upload"
            className={`inline-block px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${
              uploading
                ? "bg-gray-300 text-gray-500"
                : "bg-emerald-500 hover:bg-emerald-600 text-white"
            }`}
          >
            {uploading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                กำลังอัพโหลด...
              </span>
            ) : (
              "เลือกรูปภาพ"
            )}
          </label>
          <p className="text-xs text-gray-400 mt-2">รองรับ JPG, PNG, WEBP (สูงสุด 5MB)</p>
        </div>

        {/* Back Button */}
        <button
          onClick={() => setStep('payment')}
          className="w-full mt-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
          disabled={uploading}
        >
          ← กลับไปดู QR Code
        </button>
      </div>
    )
  }

  // ============================================
  // Step 5: Success
  // ============================================
  if (step === 'success') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">ส่งหลักฐานสำเร็จ</h3>
        <p className="text-gray-600 mb-6">
          เรากำลังตรวจสอบการชำระเงินของคุณ<br />
          <span className="text-emerald-600 font-medium">รอ 1-3 วันทำการ</span>
        </p>

        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-blue-700">
            <strong>หมายเหตุ:</strong> เราจะส่งอีเมลแจ้งเตือนเมื่อเปิดใช้งาน Partner สำเร็จ
          </p>
        </div>

        <button
          onClick={() => {
            router.push('/partner')
            router.refresh()
          }}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
        >
          ไปหน้า Partner Dashboard
        </button>
      </div>
    )
  }

  return null
}