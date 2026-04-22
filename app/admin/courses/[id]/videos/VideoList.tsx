"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface Video {
  id: string
  title: string
  description: string | null
  url: string
  videoId: string | null
  provider: string
  duration: number | null
  order: number
  thumbnail: string | null
}

interface Props {
  videos: Video[]
  courseId: string
}

export function VideoList({ videos, courseId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ title: '', description: '' })

  const handleDelete = async (videoId: string, title: string) => {
    if (!confirm(`ลบวิดีโอ "${title}" ?`)) return

    setLoading(videoId)
    try {
      const res = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(null)
    }
  }

  const handleEdit = (video: Video) => {
    setEditingId(video.id)
    setEditData({
      title: video.title,
      description: video.description || '',
    })
  }

  const handleSaveEdit = async (videoId: string) => {
    if (!editData.title.trim()) {
      alert('กรุณากรอกชื่อวิดีโอ')
      return
    }

    setLoading(videoId)
    try {
      const res = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      if (res.ok) {
        setEditingId(null)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(null)
    }
  }

  const handleMoveUp = async (videoId: string, currentOrder: number) => {
    if (currentOrder <= 1) return
    await updateOrder(videoId, currentOrder - 1)
  }

  const handleMoveDown = async (videoId: string, currentOrder: number) => {
    await updateOrder(videoId, currentOrder + 1)
  }

  const updateOrder = async (videoId: string, newOrder: number) => {
    setLoading(videoId)
    try {
      const res = await fetch(`/api/admin/videos/${videoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch {
      // silent fail
    } finally {
      setLoading(null)
    }
  }

  if (videos.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl"></span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">ยังไม่มีวิดีโอ</h3>
        <p className="text-gray-500 text-sm">เพิ่มวิดีโอแรกจากฟอร์มด้านซ้าย</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-4 bg-gray-50 border-b">
        <h2 className="font-semibold text-gray-900">รายการวิดีโอ ({videos.length})</h2>
      </div>

      <div className="divide-y">
        {videos.map((video, index) => (
          <div 
            key={video.id} 
            className={`p-4 hover:bg-gray-50 transition-colors ${loading === video.id ? 'opacity-50' : ''}`}
          >
            {editingId === video.id ? (
              // Edit Mode
              <div className="space-y-3">
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="ชื่อวิดีโอ"
                />
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="รายละเอียด"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(video.id)}
                    disabled={loading === video.id}
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"
                  >
                    บันทึก
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="flex items-start gap-4">
                {/* Thumbnail */}
                <div className="w-32 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                  {video.videoId ? (
                    <img
                      src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{video.title}</h3>
                      {video.description && (
                        <p className="text-sm text-gray-500 line-clamp-1 mt-0.5">
                          {video.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        ลำดับ: {video.order} • {video.provider}
                        {video.videoId && ` • ${video.videoId}`}
                      </p>
                    </div>

                    {/* Order Buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleMoveUp(video.id, video.order)}
                        disabled={index === 0 || loading === video.id}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="ขึ้น"
                      >
                        
                      </button>
                      <button
                        onClick={() => handleMoveDown(video.id, video.order)}
                        disabled={index === videos.length - 1 || loading === video.id}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        title="ลง"
                      >
                        
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      ดูใน YouTube 
                    </a>
                    <button
                      onClick={() => handleEdit(video)}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => handleDelete(video.id, video.title)}
                      disabled={loading === video.id}
                      className="text-xs text-red-600 hover:underline"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}