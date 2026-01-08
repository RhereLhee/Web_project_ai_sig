"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const refCode = searchParams.get("ref") || ""
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    referralCode: refCode,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด")
        setLoading(false)
        return
      }

      router.push("/login?registered=true")
    } catch {
      setError("เกิดข้อผิดพลาด")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold gradient-text">TechTrade</Link>
          <p className="text-gray-500 mt-2">สมัครสมาชิก</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">อีเมล</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทร</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                minLength={6}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสแนะนำ <span className="text-gray-400">(ถ้ามี)</span>
              </label>
              <input
                type="text"
                value={formData.referralCode}
                onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
                className="input"
                placeholder="เช่น ABC12345"
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              มีบัญชีแล้ว?{" "}
              <Link href="/login" className="text-emerald-600 hover:underline">เข้าสู่ระบบ</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
