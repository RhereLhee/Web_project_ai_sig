// app/(main)/admin/settings/page.tsx
"use client"

import { useState, useEffect } from "react"
import { QRCodeSVG } from "qrcode.react"

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  const [qrCodeUri, setQrCodeUri] = useState("")
  const [secret, setSecret] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  // โหลดสถานะ 2FA
  useEffect(() => {
    const load2FAStatus = async () => {
      try {
        const res = await fetch("/api/auth/2fa/status")
        if (res.ok) {
          const data = await res.json()
          setTwoFactorEnabled(data.enabled)
        }
      } catch (err) {
        console.error("Failed to load 2FA status")
      } finally {
        setLoading(false)
      }
    }
    load2FAStatus()
  }, [])

  // เริ่ม Setup 2FA
  const handleStartSetup = async () => {
    setError("")
    setMessage("")
    
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        setQrCodeUri(data.qrCodeUri)
        setSecret(data.secret)
        setSetupMode(true)
      } else {
        setError(data.error || "ไม่สามารถเริ่ม Setup ได้")
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด")
    }
  }

  // ยืนยัน OTP และเปิด 2FA
  const handleConfirmSetup = async () => {
    if (otpCode.length !== 6) {
      setError("กรุณากรอกรหัส 6 หลัก")
      return
    }

    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: otpCode }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setTwoFactorEnabled(true)
        setSetupMode(false)
        setQrCodeUri("")
        setSecret("")
        setOtpCode("")
        setMessage("✅ เปิดใช้งาน 2FA เรียบร้อยแล้ว!")
      } else {
        setError(data.error || "รหัส OTP ไม่ถูกต้อง")
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด")
    }
  }

  // ปิด 2FA
  const handleDisable2FA = async () => {
    const code = prompt("กรุณากรอกรหัส OTP 6 หลักเพื่อปิด 2FA:")
    if (!code || code.length !== 6) {
      setError("กรุณากรอกรหัส 6 หลัก")
      return
    }

    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setTwoFactorEnabled(false)
        setMessage("✅ ปิด 2FA เรียบร้อยแล้ว")
      } else {
        setError(data.error || "รหัส OTP ไม่ถูกต้อง")
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาด")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">⚙️ ตั้งค่า Admin</h1>
        <p className="text-gray-500">จัดการความปลอดภัยบัญชี</p>
      </div>

      {/* 2FA Section */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              🔐 Two-Factor Authentication (2FA)
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              เพิ่มความปลอดภัยด้วยการยืนยันตัวตน 2 ชั้น
            </p>
          </div>
          
          {/* Status Badge */}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            twoFactorEnabled 
              ? "bg-emerald-100 text-emerald-700" 
              : "bg-gray-100 text-gray-600"
          }`}>
            {twoFactorEnabled ? "เปิดใช้งาน" : "ปิดอยู่"}
          </span>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Setup Mode - แสดง QR Code */}
        {setupMode && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Scan QR Code ด้วย Google Authenticator หรือ Authy
              </p>
              
              {/* QR Code */}
              <div className="inline-block p-4 bg-white rounded-lg shadow-sm">
                <QRCodeSVG value={qrCodeUri} size={200} />
              </div>

              {/* Manual Entry */}
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1">หรือกรอก Secret Key:</p>
                <code className="text-xs bg-gray-200 px-2 py-1 rounded select-all">
                  {secret}
                </code>
              </div>
            </div>

            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                กรอกรหัส 6 หลักจาก Authenticator App
              </label>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSetupMode(false)
                  setQrCodeUri("")
                  setSecret("")
                  setOtpCode("")
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmSetup}
                disabled={otpCode.length !== 6}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ยืนยันเปิด 2FA
              </button>
            </div>
          </div>
        )}

        {/* Normal Mode */}
        {!setupMode && (
          <div>
            {twoFactorEnabled ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-emerald-800">บัญชีของคุณได้รับการปกป้อง</p>
                    <p className="text-sm text-emerald-600">2FA เปิดใช้งานอยู่</p>
                  </div>
                </div>

                <button
                  onClick={handleDisable2FA}
                  className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  ปิด 2FA
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-yellow-800">แนะนำให้เปิด 2FA</p>
                    <p className="text-sm text-yellow-600">เพิ่มความปลอดภัยให้บัญชี Admin</p>
                  </div>
                </div>

                <button
                  onClick={handleStartSetup}
                  className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  🔐 เปิดใช้งาน 2FA
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">💡 วิธีใช้งาน 2FA</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>ดาวน์โหลด Google Authenticator หรือ Authy บนมือถือ</li>
          <li>กดปุ่ม "เปิดใช้งาน 2FA" แล้ว Scan QR Code</li>
          <li>กรอกรหัส 6 หลักที่แสดงใน App เพื่อยืนยัน</li>
          <li>ครั้งต่อไปที่ Login จะต้องกรอกรหัสจาก App ด้วย</li>
        </ol>
      </div>
    </div>
  )
}