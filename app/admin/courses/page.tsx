import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { CourseForm } from "./CourseForm"

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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">จัดการคอร์ส</h1>
        <CourseForm />
      </div>

      {/* Courses List */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>คอร์ส</th>
                <th>ประเภท</th>
                <th>สถานะ</th>
                <th>วิดีโอ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => {
                const totalVideos = course.sections.reduce((sum, s) => sum + s.videos.length, 0)
                
                return (
                  <tr key={course.id}>
                    <td>
                      <div>
                        <p className="font-medium">{course.title}</p>
                        <p className="text-xs text-gray-500">{course.slug}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${!course.requiresSubscription ? 'badge-success' : 'badge-premium'}`}>
                        {!course.requiresSubscription ? 'ฟรี' : 'PRO'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${course.isPublished ? 'badge-success' : 'badge-warning'}`}>
                        {course.isPublished ? 'เผยแพร่' : 'ซ่อน'}
                      </span>
                    </td>
                    <td>{totalVideos} วิดีโอ</td>
                    <td>
                      <div className="flex space-x-2">
                        <Link href={`/admin/courses/${course.id}`} className="btn btn-outline btn-sm">
                          แก้ไข
                        </Link>
                        <Link href={`/admin/videos?course=${course.id}`} className="btn btn-outline btn-sm">
                          จัดการวิดีโอ
                        </Link>
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
