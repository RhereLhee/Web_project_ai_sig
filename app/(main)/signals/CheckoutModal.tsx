"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { PlanId } from "./SignalPackages"

interface Plan {
  id: PlanId
  label: string
  months: number
  bonus: number
  priceBaht: number
  savingLabel?: string
}

interface CheckoutModalProps {
  plan: PlanId
  plans: Plan[]
  hasReferral: boolean
  onClose: () => void
}

type Step = "loading" | "payment" | "upload" | "success"

interface OrderData {
  orderNumber: string
  orderId: string
  finalPrice: number
  originalPrice: number
  qrCodeData: string | null
  promptPayId: string
  planLabel: string
  totalMonths: number
  discountBaht: number | null
}

const REFERRAL_DISCOUNT_BAHT = 100

export function CheckoutModal({ plan, plans, hasReferral, onClose }: CheckoutModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>("loading")
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)

  const planInfo = plans.find((p) => p.id === plan)!
  const displayPrice = hasReferral ? planInfo.priceBaht - REFERRAL_DISCOUNT_BAHT : planInfo.priceBaht

  useEffect(() => {
    let cancelled = false
    const createOrder = async () => {
      try {
        const res = await fetch("/api/checkout/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentMethod: "QR_CODE", plan }),
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data.error || "เกิดข้อผิดพลาด")
          return
        }
        setOrderData({
          orderNumber: data.orderNumber,
          orderId: data.orderId,
          finalPrice: data.finalPrice,
          originalPrice: data.plan.originalPriceSatang / 100,
          qrCodeData: data.qrCodeData,
          promptPayId: data.promptPayId,
          planLabel: data.plan.label,
          totalMonths: data.plan.totalMonths,
          discountBaht: data.discount?.baht ?? null,
        })
        setStep("payment")
      } catch {
        if (!cancelled) setError("เกิดข้อผิดพลาดในการสร้างออเดอร์")
      }
    }
    createOrder()
    return () => { cancelled = true }
  }, [plan])

  const handleUploadSlip = async (file: File) => {
    if (!orderData) return
    setUploading(true)
    setError("")
    const formData = new FormData()
    formData.append("slip", file)
    formData.append("orderNumber", orderData.orderNumber)
    try {
      const res = await fetch("/api/upload-slip", { method: "POST", body: formData })
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

  const formatPromptPayId = (id: string) =>
    id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {step === "loading" && "กำลังสร้างออเดอร์..."}
              {step === "payment" && "ชำระเงิน"}
              {step === "upload" && "ส่งหลักฐาน"}
              {step === "success" && "สำเร็จ"}
            </h2>
            {step === "loading" && (
              <p className="text-xs text-gray-400 mt-0.5">{planInfo.label}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
          )}

          {/* ── Loading ── */}
          {step === "loading" && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-gray-500 text-sm">กำลังสร้างออเดอร์...</p>
              <p className="text-xs text-gray-400 mt-1">฿{displayPrice.toLocaleString()}</p>
            </div>
          )}

          {/* ── Payment ── */}
          {step === "payment" && orderData && (
            <div className="space-y-4">
              {/* Plan summary */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order #</span>
                  <span className="font-mono font-medium">{orderData.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">แพ็กเกจ</span>
                  <span className="font-medium text-right">{orderData.planLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">ใช้ได้</span>
                  <span className="font-medium">{orderData.totalMonths} เดือน</span>
                </div>
                {orderData.discountBaht && (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>ราคาเต็ม</span>
                      <span className="line-through">฿{orderData.originalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>ส่วนลดรหัสแนะนำ</span>
                      <span>-฿{orderData.discountBaht.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              {/* QR Code */}
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">สแกน QR Code เพื่อชำระเงิน</p>
                {orderData.qrCodeData ? (
                  <div className="inline-block bg-white p-3 rounded-xl border-2 border-gray-200">
                    <img src={orderData.qrCodeData} alt="PromptPay QR" className="w-48 h-48 md:w-56 md:h-56" />
                  </div>
                ) : (
                  <div className="inline-block bg-gray-100 p-8 rounded-xl">
                    <p className="text-gray-500 text-sm">ไม่สามารถสร้าง QR ได้</p>
                  </div>
                )}
              </div>

              {/* PromptPay ID */}
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">หรือโอนเงินไปที่ PromptPay</p>
                <p className="text-lg font-bold text-blue-700">{formatPromptPayId(orderData.promptPayId)}</p>
              </div>

              {/* Final amount */}
              <div className="text-center py-2">
                <p className="text-sm text-gray-500">ยอดชำระ (ตรงเป๊ะ)</p>
                <p className="text-3xl font-bold text-emerald-600">
                  ฿{orderData.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  รวมเศษสตางค์เพื่อแยกบิล — กรุณาโอนยอดนี้แบบเป๊ะๆ
                </p>
              </div>

              <button
                onClick={() => setStep("upload")}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
              >
                ชำระเงินแล้ว ส่งหลักฐาน
              </button>
              <p className="text-xs text-gray-400 text-center">หลังโอนเงินแล้ว กดปุ่มด้านบนเพื่อส่งสลิป</p>
            </div>
          )}

          {/* ── Upload slip ── */}
          {step === "upload" && orderData && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Order #</span>
                  <span className="font-mono">{orderData.orderNumber}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">ยอดชำระ</span>
                  <span className="font-bold text-emerald-600">
                    ฿{orderData.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-600 mb-3">อัพโหลดสลิปการโอนเงิน</p>
                <input
                  type="file" accept="image/*" id="slip-upload" disabled={uploading} className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadSlip(f) }}
                />
                <label
                  htmlFor="slip-upload"
                  className={`inline-flex items-center px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors ${
                    uploading ? "bg-gray-300 text-gray-500" : "bg-emerald-500 hover:bg-emerald-600 text-white"
                  }`}
                >
                  {uploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      กำลังอัพโหลด...
                    </>
                  ) : "เลือกรูปภาพ"}
                </label>
                <p className="text-xs text-gray-400 mt-2">รองรับ JPG, PNG, WEBP (สูงสุด 5MB)</p>
              </div>

              <button onClick={() => setStep("payment")} className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm" disabled={uploading}>
                กลับไปดู QR Code
              </button>
            </div>
          )}

          {/* ── Success ── */}
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
              <button
                onClick={() => { onClose(); router.refresh() }}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-semibold transition-colors"
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
