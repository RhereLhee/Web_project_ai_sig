"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface ProfileEditFormProps {
  isOpen: boolean
  onClose: () => void
  initialData: {
    name: string | null
    phone: string | null
  }
  isPhoneLocked: boolean
}

// ฟังก์ชันแปลงเบอร์โทรให้แสดงแบบไทย (0xxx)
function formatPhoneDisplay(phone: string | null): string {
  if (!phone) return ''
  
  // ถ้าขึ้นต้นด้วย 66 ให้แปลงเป็น 0
  if (phone.startsWith('66')) {
    return '0' + phone.slice(2)
  }
  // ถ้าขึ้นต้นด้วย +66 ให้แปลงเป็น 0
  if (phone.startsWith('+66')) {
    return '0' + phone.slice(3)
  }
  
  return phone
}

export function ProfileEditForm({ isOpen, onClose, initialData, isPhoneLocked }: ProfileEditFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    phone: formatPhoneDisplay(initialData.phone),
  })

  // Reset form เมื่อเปิด modal
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData.name || "",
        phone: formatPhoneDisplay(initialData.phone),
      })
      setError("")
      setSuccess("")
    }
  }, [isOpen, initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: isPhoneLocked ? undefined : formData.phone, // ไม่ส่ง phone ถ้าถูกล็อค
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      setSuccess('อัปเดตโปรไฟล์สำเร็จ')
      
      // รอสักครู่แล้วปิด modal
      setTimeout(() => {
        router.refresh()
        onClose()
      }, 1000)

    } catch (err) {
      setError('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชันจัดรูปแบบเบอร์โทร
  const formatPhoneInput = (value: string) => {
    // เอาแค่ตัวเลข
    const numbers = value.replace(/\D/g, '')
    // จำกัด 10 หลัก
    return numbers.slice(0, 10)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">แก้ไขโปรไฟล์</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 text-sm">
              ✓ {success}
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
              placeholder="ชื่อของคุณ"
              maxLength={100}
            />
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              เบอร์โทรศัพท์
            </label>
            
            {isPhoneLocked ? (
              // เบอร์ถูกล็อค - แสดงแบบ read-only พร้อม warning
              <div>
                <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
                  {formData.phone || '-'}
                </div>
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <span className="text-yellow-600">🔒</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">เบอร์โทรถูกล็อค</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        เนื่องจากมีการถอนเงินแล้ว ไม่สามารถเปลี่ยนเบอร์ได้<br/>
                        หากต้องการเปลี่ยน กรุณาติดต่อ Admin
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // เบอร์ยังไม่ถูกล็อค - แก้ไขได้ (ไม่มี warning)
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: formatPhoneInput(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                placeholder="0912345678"
                maxLength={10}
              />
            )}
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}