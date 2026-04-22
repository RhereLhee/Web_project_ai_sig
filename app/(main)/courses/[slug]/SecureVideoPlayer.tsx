"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface Props {
  videoDbId: string        // Database ID (ไม่ใช่ YouTube ID)
  title: string
  description: string | null
  duration: number | null
  isCompleted: boolean
  prevIndex: number | null  // ลำดับก่อนหน้า (v=1, v=2, ...)
  nextIndex: number | null  // ลำดับถัดไป
  courseSlug: string
  totalVideos: number
  currentIndex: number
}

export function SecureVideoPlayer({
  videoDbId,
  title,
  description,
  duration,
  isCompleted: initialCompleted,
  prevIndex,
  nextIndex,
  courseSlug,
  totalVideos,
  currentIndex,
}: Props) {
  const [youtubeId, setYoutubeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(initialCompleted)
  const [markingComplete, setMarkingComplete] = useState(false)

  // โหลด Video ID จาก API (ซ่อนใน Network request)
  useEffect(() => {
    const fetchVideoId = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/video-stream/${videoDbId}`)
        const data = await res.json()

        if (res.ok && data.success) {
          setYoutubeId(data.data.videoId)
        } else {
          setError(data.error || 'ไม่สามารถโหลดวิดีโอได้')
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      } finally {
        setLoading(false)
      }
    }

    fetchVideoId()
  }, [videoDbId])

  // Mark as complete
  const handleMarkComplete = async () => {
    setMarkingComplete(true)
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: videoDbId,
          watchedSeconds: duration || 0,
          completed: true,
          progress: 100,
        }),
      })
      setIsCompleted(true)
    } catch (error) {
      console.error('Failed to mark complete:', error)
    } finally {
      setMarkingComplete(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Video Title Bar */}
      <div className="p-4 bg-gray-900 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 mb-1">
              วิดีโอ {currentIndex} / {totalVideos}
            </p>
            <h2 className="font-medium text-lg">{title}</h2>
          </div>
          {isCompleted && (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">
              ดูแล้ว
            </span>
          )}
        </div>
        {description && (
          <p className="text-gray-400 text-sm mt-2">{description}</p>
        )}
      </div>

      {/* Video Player */}
      <div className="aspect-video bg-black">
        {loading ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-10 h-10 border-4 border-gray-600 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
            <span>กำลังโหลดวิดีโอ...</span>
          </div>
        ) : error ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-red-400 p-4">
            <span className="text-4xl mb-4"></span>
            <span className="text-center">{error}</span>
          </div>
        ) : youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span>ไม่พบวิดีโอ</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t">
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mb-4">
          {/* Previous */}
          {prevIndex ? (
            <Link
              href={`/courses/${courseSlug}?v=${prevIndex}`}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <span></span>
              <span className="text-sm">ก่อนหน้า</span>
            </Link>
          ) : (
            <div className="px-4 py-2 text-gray-300 rounded-lg">
              <span className="text-sm">ก่อนหน้า</span>
            </div>
          )}

          {/* Mark Complete Button */}
          <button
            onClick={handleMarkComplete}
            disabled={markingComplete || isCompleted}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {isCompleted ? 'ดูจบแล้ว' : markingComplete ? 'กำลังบันทึก...' : 'ทำเครื่องหมายว่าดูจบ'}
          </button>

          {/* Next */}
          {nextIndex ? (
            <Link
              href={`/courses/${courseSlug}?v=${nextIndex}`}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <span className="text-sm">ถัดไป</span>
              <span></span>
            </Link>
          ) : (
            <div className="px-4 py-2 text-gray-300 rounded-lg">
              <span className="text-sm">ถัดไป </span>
            </div>
          )}
        </div>

        {/* Next Video Preview */}
        {nextIndex && (
          <Link
            href={`/courses/${courseSlug}?v=${nextIndex}`}
            className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-medium">
                {nextIndex}
              </div>
              <div>
                <p className="text-xs text-gray-500">วิดีโอถัดไป</p>
                <p className="text-sm font-medium text-gray-900">กดเพื่อไปวิดีโอถัดไป </p>
              </div>
            </div>
          </Link>
        )}

        {/* Course Complete */}
        {!nextIndex && isCompleted && (
          <div className="p-4 bg-emerald-50 rounded-lg text-center">
            <span className="text-2xl"></span>
            <p className="font-medium text-emerald-800 mt-2">ยินดีด้วย! คุณดูจบคอร์สแล้ว</p>
            <Link
              href="/courses"
              className="inline-block mt-3 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
            >
              ดูคอร์สอื่น
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}