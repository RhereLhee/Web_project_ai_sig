"use client"

import { useState } from "react"
import Link from "next/link"

interface Video {
  id: string
  title: string
  description: string | null
  url: string
  videoId: string | null
  provider: string
  duration: number | null
}

interface Progress {
  id: string
  progress: number
  watchedSeconds: number
  completed: boolean
}

interface Props {
  video: Video
  userId: string
  progress?: Progress
  prevVideo: Video | null
  nextVideo: Video | null
  courseSlug: string
}

export function VideoPlayerWithNav({ 
  video, 
  userId, 
  progress, 
  prevVideo, 
  nextVideo, 
  courseSlug 
}: Props) {
  const [isCompleted, setIsCompleted] = useState(progress?.completed || false)
  const [loading, setLoading] = useState(false)

  // YouTube embed URL
  const getEmbedUrl = () => {
    if (video.provider === 'youtube' && video.videoId) {
      return `https://www.youtube.com/embed/${video.videoId}?rel=0&modestbranding=1`
    }
    return video.url
  }

  // Mark as complete
  const handleMarkComplete = async () => {
    setLoading(true)
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          watchedSeconds: video.duration || 0,
          completed: true,
          progress: 100,
        }),
      })
      setIsCompleted(true)
    } catch (error) {
      console.error('Failed to mark complete:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Video Title Bar */}
      <div className="p-4 bg-gray-900 text-white">
        <h2 className="font-medium text-lg">{video.title}</h2>
        {video.description && (
          <p className="text-gray-400 text-sm mt-1">{video.description}</p>
        )}
      </div>

      {/* Video Player */}
      <div className="aspect-video bg-black">
        {video.provider === 'youtube' && video.videoId ? (
          <iframe
            src={getEmbedUrl()}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-lg">ไม่พบวิดีโอ</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t">
        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mb-4">
          {/* Previous */}
          {prevVideo ? (
            <Link
              href={`/courses/${courseSlug}?video=${prevVideo.id}`}
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
            disabled={loading || isCompleted}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            {isCompleted ? 'ดูจบแล้ว' : loading ? 'กำลังบันทึก...' : 'ทำเครื่องหมายว่าดูจบ'}
          </button>

          {/* Next */}
          {nextVideo ? (
            <Link
              href={`/courses/${courseSlug}?video=${nextVideo.id}`}
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
        {nextVideo && (
          <Link
            href={`/courses/${courseSlug}?video=${nextVideo.id}`}
            className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <p className="text-xs text-gray-500 mb-1">วิดีโอถัดไป</p>
            <div className="flex items-center gap-3">
              {nextVideo.videoId && (
                <div className="w-16 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={`https://img.youtube.com/vi/${nextVideo.videoId}/default.jpg`}
                    alt={nextVideo.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{nextVideo.title}</p>
            </div>
          </Link>
        )}

        {/* Course Complete */}
        {!nextVideo && isCompleted && (
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