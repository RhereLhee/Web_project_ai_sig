"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function CourseForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'TRADING',
    requiresSubscription: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else {
        alert('เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        + สร้างคอร์สใหม่
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">สร้างคอร์สใหม่</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">ชื่อคอร์ส</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">รายละเอียด</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ประเภท</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input"
                >
                  <option value="TRADING">การเทรด</option>
                  <option value="FINANCE">การเงิน</option>
                </select>
              </div>

              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={!formData.requiresSubscription}
                  onChange={(e) => setFormData({ ...formData, requiresSubscription: !e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">คอร์สฟรี (ไม่ต้อง subscription)</span>
              </label>

              <div className="flex space-x-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-outline flex-1">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  {loading ? 'กำลังสร้าง...' : 'สร้างคอร์ส'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
