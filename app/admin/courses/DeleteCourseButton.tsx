"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('ลบคอร์สนี้? (วิดีโอทั้งหมดจะถูกลบด้วย)')) return
    
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/courses/${courseId}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
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
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-red-600 hover:underline text-sm disabled:opacity-50"
    >
      {loading ? '...' : 'ลบ'}
    </button>
  )
}
