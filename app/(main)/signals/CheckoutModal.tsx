"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface Plan {
  months: number
  price: number
  bonus: number
}

interface CheckoutModalProps {
  plan: Plan
  hasReferral: boolean
  referralDiscount: number
  onClose: () => void
}

type Step = "loading" | "payment" | "upload" | "success"

interface OrderData {
  orderNumber: string
  orderId: string
  finalPrice: number
  qrCodeData: string
  promptPayId: string
}

export function CheckoutModal({ plan, hasReferral, referralDiscount, onClose }: CheckoutModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("loading")
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)

  // สร้าง Order เมื่อเปิด Modal
  useEffect(() => {
    createOrder()
  }, [])

  const createOrder = async () => {
    try {
      const res = await fetch("/api/checkout/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          months: plan.months,
          paymentMethod: "QR_CODE",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด")
        return
      }

      setOrderData({
        orderNumber: data.orderNumber,
        orderId: data.orderId,
        finalPrice: data.finalPrice,
        qrCodeData: data.qrCodeData,
        promptPayId: data.promptPayId,
      })
      setStep("payment")
    } catch {
      setError("เกิดข้อผิดพลาดในการสร้างออเดอร์")
    }
  }

  const handleUploadSlip = async (file: File) => {
    if (!orderData) return

    setUploading(true)
    setError("")

    const formData = new FormData()
    formData.append("slip", file)
    formData.append("orderNumber", orderData.orderNumber)

    try {
      const res = await fetch("/api/upload-slip", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "อัพโหลดไม่สำเร็จ")
        setUploading(false)
        return
      }

      setStep("success")
    } catch {
      setError("เกิดข้อผิดพลาดในการอัพโหลด")
    } finally {
      setUploading(false)
    }
  }

  const formatPromptPayId = (id: string) => {
    if (id.length === 10) {
      return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`
    }
    return id
  }

  const totalMonths = plan.months + plan.bonus
  const originalPrice = plan.price
  const finalPrice = hasReferral ? plan.price - referralDiscount : plan.price

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === "loading" && "กำลังสร้างออเดอร์..."}
            {step === "payment" && "ชำระเงิน"}
            {step === "upload" && "ส่งหลักฐาน"}
            {step === "success" && "สำเร็จ"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
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

          {/* STEP: LOADING */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-500">กำลังสร้างออเดอร์...</p>
            </div>
          )}

          {/* STEP: PAYMENT */}
          {step === "payment" && orderData && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Order #</span>
                  <span className="font-mono font-medium">{orderData.orderNumber}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">แพ็คเกจ</span>
                  <span className="font-medium">Signal {plan.months} เดือน</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">สแกน QR Code เพื่อชำระเงิน</p>
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
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">หรือโอนเงินไปที่ PromptPay</p>
                <p className="text-lg font-bold text-blue-700">
                  {formatPromptPayId(orderData.promptPayId)}
                </p>
              </div>

              {/* Amount */}
              <div className="text-center py-2">
                <p className="text-sm text-gray-500">ยอดชำระ</p>
                {hasReferral ? (
                  <>
                    <p className="text-3xl font-bold text-emerald-600">
                      ฿{orderData.finalPrice.toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-400 line-through">
                      ฿{originalPrice.toLocaleString()}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">
                      ส่วนลดจากรหัสแนะนำ -฿{referralDiscount.toLocaleString()}
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-emerald-600">
                    ฿{orderData.finalPrice.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Next Button */}
              <button
                onClick={() => setStep("upload")}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition-colors"
              >
                ชำระเงินแล้ว → ส่งหลักฐาน
              </button>

              <p className="text-xs text-gray-400 text-center">
                หลังโอนเงินแล้ว กดปุ่มด้านบนเพื่อส่งสลิป
              </p>
            </div>
          )}

          {/* STEP: UPLOAD */}
          {step === "upload" && orderData && (
            <div className="space-y-4">
              {/* Order Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
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
                onClick={() => setStep("payment")}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
                disabled={uploading}
              >
                ← กลับไปดู QR Code
              </button>
            </div>
          )}

          {/* STEP: SUCCESS */}
          {step === "success" && (
            <div className="text-center py-6">
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
                  <strong>หมายเหตุ:</strong> เราจะส่งอีเมลแจ้งเตือนเมื่อเปิดใช้งานสำเร็จ
                </p>
              </div>

              <button
                onClick={() => {
                  onClose()
                  router.refresh()
                }}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-semibold transition-colors"
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