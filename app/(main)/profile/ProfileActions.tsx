"use client"
// ProfileActions — client shell that owns all modal state for the profile page.
// The page itself is a Server Component; this wrapper renders the edit buttons
// and mounts the dialogs so they don't force the whole page client-side.

import { useState } from "react"
import { ProfileEditForm } from "@/components/ProfileEditForm"
import { ChangePasswordForm } from "@/components/ChangePasswordForm"
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog"

interface ProfileActionsProps {
  user: {
    name: string | null
    phone: string | null
    email: string
  }
  isPhoneLocked: boolean
  hasReferrals: boolean
}

export function ProfileActions({ user, isPhoneLocked, hasReferrals }: ProfileActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <>
      {/* ── ข้อมูลส่วนตัว ── */}
      <section className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">ข้อมูลส่วนตัว</h2>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0110 16.414V19h2.586a2 2 0 001.414-.586l6-6a2 2 0 000-2.828l-3.536-3.536a2 2 0 00-2.828 0L8 11" />
            </svg>
            แก้ไข
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500">ชื่อ</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{user.name || <span className="text-gray-400 italic">ยังไม่ได้ตั้ง</span>}</dd>
          </div>
          <div>
            <dt className="text-gray-500">อีเมล</dt>
            <dd className="font-medium text-gray-900 mt-0.5">{user.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500 flex items-center gap-1">
              เบอร์โทรศัพท์
              {isPhoneLocked && (
                <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">ล็อค</span>
              )}
            </dt>
            <dd className="font-medium text-gray-900 mt-0.5">
              {user.phone || <span className="text-gray-400 italic">ยังไม่ได้ใส่</span>}
            </dd>
          </div>
        </dl>
      </section>

      {/* ── ความปลอดภัย ── */}
      <section className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <h2 className="font-semibold text-gray-900 mb-4">ความปลอดภัย</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">รหัสผ่าน</p>
            <p className="text-xs text-gray-500 mt-0.5">เปลี่ยนรหัสผ่านของบัญชีคุณ</p>
          </div>
          <button
            onClick={() => setPwOpen(true)}
            className="px-4 py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </section>

      {/* ── Danger Zone ── */}
      <section className="bg-white rounded-xl shadow-sm p-5 md:p-6 border border-red-100">
        <h2 className="font-semibold text-red-700 mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">การกระทำในส่วนนี้ไม่สามารถย้อนกลับได้</p>
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
          <div>
            <p className="text-sm font-medium text-red-800">ลบบัญชี</p>
            <p className="text-xs text-red-600 mt-0.5">
              {hasReferrals
                ? "สมาชิกในสายของคุณจะย้ายขึ้นหาผู้แนะนำระดับบน"
                : "ลบข้อมูลส่วนตัวทั้งหมดออกจากระบบ"}
            </p>
          </div>
          <button
            onClick={() => setDeleteOpen(true)}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            ลบบัญชี
          </button>
        </div>
      </section>

      {/* Modals */}
      <ProfileEditForm
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        initialData={{ name: user.name, phone: user.phone }}
        isPhoneLocked={isPhoneLocked}
      />
      <ChangePasswordForm isOpen={pwOpen} onClose={() => setPwOpen(false)} />
      <DeleteAccountDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        userEmail={user.email}
        hasReferrals={hasReferrals}
      />
    </>
  )
}
