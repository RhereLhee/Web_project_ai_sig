"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Course {
  id: string
  title: string
  sections: Array<{ id: string; title: string }>
}

export function VideoUploadForm({ courses }: { courses: Course[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    courseId: '',
    sectionId: '',
    title: '',
    youtubeUrl: '',
    duration: '',
  })

  const selectedCourse = courses.find(c => c.id === formData.courseId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Extract YouTube video ID
      const youtubeMatch = formData.youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
      const videoId = youtubeMatch ? youtubeMatch[1] : null

      const res = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: formData.sectionId,
          title: formData.title,
          url: formData.youtubeUrl,
          videoId,
          provider: 'youtube',
          duration: parseInt(formData.duration) * 60 || null,
        }),
      })

      if (res.ok) {
        setOpen(false)
        setFormData({ courseId: '', sectionId: '', title: '', youtubeUrl: '', duration: '' })
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
        + อัพโหลดวิดีโอ
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">อัพโหลดวิดีโอ</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">คอร์ส</label>
                <select
                  value={formData.courseId}
                  onChange={(e) => setFormData({ ...formData, courseId: e.target.value, sectionId: '' })}
                  className="input"
                  required
                >
                  <option value="">เลือกคอร์ส</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>

              {selectedCourse && (
                <div>
                  <label className="block text-sm font-medium mb-1">Section</label>
                  <select
                    value={formData.sectionId}
                    onChange={(e) => setFormData({ ...formData, sectionId: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">เลือก Section</option>
                    {selectedCourse.sections.map((section) => (
                      <option key={section.id} value={section.id}>{section.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">ชื่อวิดีโอ</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">YouTube URL</label>
                <input
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={(e) => setFormData({ ...formData, youtubeUrl: e.target.value })}
                  className="input"
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ความยาว (นาที)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className="input"
                  placeholder="เช่น 10"
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-outline flex-1">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
