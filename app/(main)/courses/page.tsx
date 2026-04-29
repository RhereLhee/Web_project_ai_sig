import { getUserWithSubscription } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function CoursesPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h1 className="text-xl font-bold text-gray-900">ห้องเรียน</h1>
        <p className="text-sm text-gray-500 mt-1">คอร์สสำหรับสมาชิก TechTrade</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">ยังไม่พร้อมใช้งาน</h2>
        <p className="text-sm text-gray-400">เรากำลังเตรียมเนื้อหาคอร์ส<br />โปรดติดตามการอัปเดตเร็วๆ นี้</p>
      </div>
    </div>
  )
}
