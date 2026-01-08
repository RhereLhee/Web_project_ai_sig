"use client"

import { useEffect, useRef } from "react"

interface VideoPlayerProps {
  video: {
    id: string
    title: string
    url: string
    videoId?: string | null
    provider: string
    duration?: number | null
  }
  userId: string
  progress?: {
    id: string
    progress: number
    watchedSeconds: number
  }
}

export function VideoPlayer({ video, userId, progress }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // YouTube embed URL
  const getEmbedUrl = () => {
    if (video.provider === 'youtube' && video.videoId) {
      const start = progress?.watchedSeconds || 0
      return `https://www.youtube.com/embed/${video.videoId}?start=${start}&autoplay=0&rel=0`
    }
    return video.url
  }

  // Update progress (in real app, this would be more sophisticated)
  const updateProgress = async (watchedSeconds: number, completed: boolean) => {
    try {
      await fetch('/api/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          watchedSeconds,
          completed,
        }),
      })
    } catch (error) {
      console.error('Failed to update progress:', error)
    }
  }

  return (
    <div ref={containerRef}>
      {/* Video Title */}
      <div className="p-4 bg-gray-900 text-white">
        <h2 className="font-medium">{video.title}</h2>
      </div>

      {/* Video Player */}
      <div className="aspect-video bg-black">
        {video.provider === 'youtube' && video.videoId ? (
          <iframe
            src={getEmbedUrl()}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <video
            src={video.url}
            className="w-full h-full"
            controls
            onTimeUpdate={(e) => {
              const target = e.target as HTMLVideoElement
              const watchedSeconds = Math.floor(target.currentTime)
              const completed = target.duration > 0 && 
                (target.currentTime / target.duration) > 0.9
              
              // Update every 30 seconds
              if (watchedSeconds % 30 === 0) {
                updateProgress(watchedSeconds, completed)
              }
            }}
            onEnded={() => {
              updateProgress(video.duration || 0, true)
            }}
          />
        )}
      </div>

      {/* Mark Complete Button */}
      <div className="p-4 border-t flex justify-between items-center">
        <span className="text-sm text-gray-500">
          {progress?.progress || 0}% เสร็จสิ้น
        </span>
        <button
          onClick={() => updateProgress(video.duration || 0, true)}
          className="btn btn-outline text-sm"
        >
          ทำเครื่องหมายว่าดูจบแล้ว
        </button>
      </div>
    </div>
  )
}
