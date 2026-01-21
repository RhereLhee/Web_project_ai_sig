"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Props {
  courseId: string
  sectionId: string
}

export function VideoForm({ courseId, sectionId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
  })

  // ดึง YouTube Video ID จาก URL
  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Video ID ตรงๆ
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }

    return null
  }

  // Preview video ID
  const videoId = extractYouTubeId(formData.url)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      setMessage("⚠️ กรุณากรอกชื่อวิดีโอ")
      return
    }

    if (!videoId) {
      setMessage("⚠️ YouTube URL ไม่ถูกต้อง")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      const res = await fetch('/api/admin/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          title: formData.title,
          description: formData.description,
          url: formData.url,
          videoId,
          provider: 'youtube',
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage("✅ เพิ่มวิดีโอสำเร็จ")
        setFormData({ title: '', description: '', url: '' })
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
    <div className="bg-white rounded-lg border p-6 sticky top-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">➕ เพิ่มวิดีโอใหม่</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* YouTube URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            YouTube URL <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
          {formData.url && !videoId && (
            <p className="text-xs text-red-500 mt-1">URL ไม่ถูกต้อง</p>
          )}
          {videoId && (
            <p className="text-xs text-emerald-600 mt-1">✓ Video ID: {videoId}</p>
          )}
        </div>

        {/* Preview */}
        {videoId && (
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ชื่อวิดีโอ <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="เช่น บทที่ 1: เริ่มต้นเทรด"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            รายละเอียด (ไม่บังคับ)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="อธิบายเนื้อหาวิดีโอ..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
          />
        </div>

        {/* Message */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.includes('✅') 
              ? 'bg-emerald-50 text-emerald-700' 
              : 'bg-yellow-50 text-yellow-700'
          }`}>
            {message}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !videoId || !formData.title.trim()}
          className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'กำลังเพิ่ม...' : '➕ เพิ่มวิดีโอ'}
        </button>
      </form>

      {/* Help */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>💡 วิธีใช้:</strong><br />
          1. Copy URL จาก YouTube<br />
          2. วาง URL ในช่องด้านบน<br />
          3. ตั้งชื่อวิดีโอ<br />
          4. กดเพิ่ม → ขึ้นหน้า User ทันที
        </p>
      </div>
    </div>
  )
}