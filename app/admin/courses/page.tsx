import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { CourseForm } from "./CourseForm"
import { DeleteCourseButton } from "./DeleteCourseButton"

async function getCourses() {
  return await prisma.course.findMany({
    include: {
      sections: {
        include: { videos: true },
      },
    },
    orderBy: { order: 'asc' },
  })
}

export default async function AdminCoursesPage() {
  const courses = await getCourses()

  const accessColors: Record<string, string> = {
    FREE: 'bg-emerald-100 text-emerald-700',
    PRO: 'bg-blue-100 text-blue-700',
    PARTNER: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">จัดการคอร์ส ({courses.length})</h1>
        <CourseForm />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">ลำดับ</th>
                <th className="text-left p-3 font-medium">คอร์ส</th>
                <th className="text-left p-3 font-medium">ประเภท</th>
                <th className="text-left p-3 font-medium">สิทธิ์</th>
                <th className="text-left p-3 font-medium">สถานะ</th>
                <th className="text-left p-3 font-medium">Sections</th>
                <th className="text-left p-3 font-medium">วิดีโอ</th>
                <th className="text-left p-3 font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {courses.map((course, index) => {
                const totalVideos = course.sections.reduce((sum, s) => sum + s.videos.length, 0)
                
                return (
                  <tr key={course.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500">{index + 1}</td>
                    <td className="p-3">
                      <p className="font-medium">{course.title}</p>
                      <p className="text-xs text-gray-500">{course.slug}</p>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {course.type}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${accessColors[course.access]}`}>
                        {course.access}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        course.isPublished 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {course.isPublished ? 'เผยแพร่' : 'ซ่อน'}
                      </span>
                    </td>
                    <td className="p-3">{course.sections.length}</td>
                    <td className="p-3">{totalVideos}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link 
                          href={`/admin/courses/${course.id}`}
                          className="text-emerald-600 hover:underline text-sm"
                        >
                          แก้ไข
                        </Link>
                        <Link 
                          href={`/admin/courses/${course.id}/sections`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Sections
                        </Link>
                        <DeleteCourseButton courseId={course.id} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {courses.length === 0 && (
          <p className="text-center text-gray-500 py-8">ยังไม่มีคอร์ส</p>
        )}
      </div>
    </div>
  )
}
