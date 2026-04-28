"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface DeleteAccountDialogProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
  hasReferrals: boolean   // มีสายอยู่หรือไม่ — ถ้ามีจะแสดงคำเตือนเพิ่ม
}

export function DeleteAccountDialog({ isOpen, onClose, userEmail, hasReferrals }: DeleteAccountDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({ password: "", confirmEmail: "" })

  function handleClose() {
    setStep(1)
    setForm({ password: "", confirmEmail: "" })
    setError("")
    onClose()
  }

  async function handleDelete() {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/profile/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password, confirmEmail: form.confirmEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "เกิดข้อผิดพลาด"); return }
      // Clear cookies & redirect to home — account is gone.
      router.push("/login?deleted=1")
    } catch {
      setError("เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">ลบบัญชี</h2>
            <p className="text-sm text-gray-500">การกระทำนี้ไม่สามารถย้อนกลับได้</p>
          </div>
          <button onClick={handleClose} className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            {/* What will happen */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2 text-sm">
              <p className="font-semibold text-red-800">เมื่อลบบัญชีแล้ว:</p>
              <ul className="text-red-700 space-y-1 list-disc list-inside">
                <li>ข้อมูลส่วนตัว (ชื่อ อีเมล เบอร์โทร) จะถูกลบทันที</li>
                <li>ไม่สามารถเข้าสู่ระบบได้อีก</li>
                {hasReferrals && (
                  <li className="font-medium">
                    สมาชิกในสายของคุณจะย้ายขึ้นไปอยู่กับผู้แนะนำของคุณโดยอัตโนมัติ
                  </li>
                )}
                <li>ประวัติออเดอร์และการเงินจะถูกเก็บไว้เพื่อการบัญชี</li>
              </ul>
            </div>

            {hasReferrals && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <span className="font-semibold">คุณมีสมาชิกในสาย</span> — เมื่อลบบัญชี ระบบจะย้ายสมาชิกเหล่านั้นขึ้นไปอยู่กับผู้แนะนำระดับบนของคุณโดยอัตโนมัติ (ตามโครงสร้าง affiliate)
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                ดำเนินการต่อ
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              กรอกข้อมูลด้านล่างเพื่อยืนยันการลบบัญชี
            </p>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                อีเมลของคุณ <span className="text-gray-400 font-normal">(พิมพ์เพื่อยืนยัน)</span>
              </label>
              <input
                type="email"
                value={form.confirmEmail}
                onChange={(e) => setForm({ ...form, confirmEmail: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder={userEmail}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="••••••••"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setStep(1); setError("") }}
                disabled={loading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || !form.password || !form.confirmEmail}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium"
              >
                {loading ? "กำลังลบ..." : "ลบบัญชีถาวร"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
