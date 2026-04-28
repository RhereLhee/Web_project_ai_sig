"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

interface AvatarUploadProps {
  currentImage: string | null | undefined
  userName: string | null | undefined
  userEmail: string | null | undefined
}

export function AvatarUpload({ currentImage, userName, userEmail }: AvatarUploadProps) {
  const router = useRouter()
  const [preview, setPreview] = useState<string | null>(currentImage ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const initial = userName?.charAt(0) || userEmail?.charAt(0) || 'U'

  const handleFile = async (file: File) => {
    setError("")
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setLoading(true)

    const formData = new FormData()
    formData.append('avatar', file)

    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'อัพโหลดไม่สำเร็จ')
        setPreview(currentImage ?? null)
      } else {
        setPreview(data.imageUrl)
        router.refresh()
      }
    } catch {
      setError('เกิดข้อผิดพลาด')
      setPreview(currentImage ?? null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-shrink-0 relative group">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-20 h-20 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-emerald-500"
        disabled={loading}
        title="คลิกเพื่อเปลี่ยนรูปโปรไฟล์"
      >
        {preview ? (
          <img src={preview} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-3xl font-bold">
            {initial}
          </div>
        )}
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      {error && (
        <p className="absolute top-full mt-1 text-xs text-red-600 whitespace-nowrap">{error}</p>
      )}
    </div>
  )
}
