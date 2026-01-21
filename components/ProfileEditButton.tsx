"use client"

import { useState } from "react"
import { ProfileEditForm } from "./ProfileEditForm"

interface ProfileClientProps {
  user: {
    name: string | null
    phone: string | null
  }
  isPhoneLocked: boolean
}

export function ProfileEditButton({ user, isPhoneLocked }: ProfileClientProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span>แก้ไขโปรไฟล์</span>
      </button>

      <ProfileEditForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        initialData={{
          name: user.name,
          phone: user.phone,
        }}
        isPhoneLocked={isPhoneLocked}
      />
    </>
  )
}