"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({ email: "", password: "" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "เข้าสู่ระบบไม่สำเร็จ")
        setLoading(false)
        return
      }

      // Login สำเร็จ
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError("เกิดข้อผิดพลาด")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold gradient-text">TechTrade</Link>
          <p className="text-gray-500 mt-2">เข้าสู่ระบบ</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

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
              <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">
              ยังไม่มีบัญชี?{" "}
              <Link href="/register" className="text-emerald-600 hover:underline">สมัครสมาชิก</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}