"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  type: string
  access: string
  isPublished: boolean
  order: number
}

interface Props {
  course: Course
}

export function EditCourseForm({ course }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [formData, setFormData] = useState({
    title: course.title,
    description: course.description || '',
    type: course.type,
    access: course.access,
    isPublished: course.isPublished,
    order: course.order,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage("")

    try {
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage("✅ บันทึกสำเร็จ")
        router.refresh()
      } else {
        setMessage(`⚠️ ${data.error || 'เกิดข้อผิดพลาด'}`)
      }
    } catch {
      setMessage("⚠️ เกิดข้อผิดพลาด")
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(""), 3000)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">📝 แก้ไขข้อมูลคอร์ส</h2>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อคอร์ส <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          รายละเอียด
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          rows={4}
          placeholder="อธิบายเนื้อหาคอร์ส..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ประเภท
          </label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="TRADING">การเทรด</option>
            <option value="FINANCE">การเงิน</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            สิทธิ์การเข้าถึง
          </label>
          <select
            value={formData.access}
            onChange={(e) => setFormData({ ...formData, access: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="FREE">FREE - ทุกคนดูได้</option>
            <option value="PRO">PRO - เฉพาะคนซื้อ Signal</option>
            <option value="PARTNER">PARTNER - เฉพาะ Partner</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ลำดับการแสดง
        </label>
        <input
          type="number"
          value={formData.order}
          onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          min={0}
        />
        <p className="text-xs text-gray-500 mt-1">ตัวเลขน้อย = แสดงก่อน</p>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="isPublished"
          checked={formData.isPublished}
          onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
        />
        <label htmlFor="isPublished" className="text-sm text-gray-700">
          เผยแพร่คอร์ส (แสดงในหน้าเว็บ)
        </label>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.includes('✅') 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'bg-yellow-50 text-yellow-700'
        }`}>
          {message}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'กำลังบันทึก...' : '💾 บันทึกการเปลี่ยนแปลง'}
        </button>
      </div>
    </form>
  )
}