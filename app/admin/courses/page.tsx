// app/admin/courses/page.tsx
// Admin courses management is locked — course feature not yet open for service.
// When ready to launch, restore the previous version from git history.

export default function AdminCoursesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">จัดการคอร์ส</h1>
      </div>

      <div className="bg-white rounded-xl border p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">ยังไม่เปิดให้บริการ</h2>
        <p className="text-gray-500">
          ระบบจัดการคอร์สถูกล็อกชั่วคราว จะเปิดใช้งานเมื่อเนื้อหาคอร์สพร้อมเผยแพร่
        </p>
      </div>
    </div>
  )
}
