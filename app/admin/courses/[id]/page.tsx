import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { EditCourseForm } from "./EditCourseForm"

interface Props {
  params: Promise<{ id: string }>
}

async function getCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sections: {
        include: { videos: true },
        orderBy: { order: 'asc' },
      },
    },
  })

  return course
}

export default async function EditCoursePage({ params }: Props) {
  const { id } = await params
  const course = await getCourse(id)

  if (!course) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">แก้ไขคอร์ส</h1>
          <p className="text-gray-500 text-sm mt-1">{course.title}</p>
        </div>
        <Link href="/admin/courses" className="text-gray-500 hover:text-gray-700">
          กลับ
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Edit Form */}
        <div className="lg:col-span-2">
          <EditCourseForm course={course} />
        </div>

        {/* Course Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">ข้อมูลคอร์ส</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Slug</span>
                <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{course.slug}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sections</span>
                <span className="font-medium">{course.sections.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">วิดีโอ</span>
                <span className="font-medium">
                  {course.sections.reduce((sum, s) => sum + s.videos.length, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">สร้างเมื่อ</span>
                <span>{new Date(course.createdAt).toLocaleDateString('th-TH')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">อัปเดตเมื่อ</span>
                <span>{new Date(course.updatedAt).toLocaleDateString('th-TH')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Sections</h3>
            {course.sections.length > 0 ? (
              <div className="space-y-2">
                {course.sections.map((section, index) => (
                  <div key={section.id} className="p-2 bg-gray-50 rounded text-sm">
                    <p className="font-medium">{index + 1}. {section.title}</p>
                    <p className="text-xs text-gray-500">{section.videos.length} วิดีโอ</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-2">ยังไม่มี Section</p>
            )}
            
            <Link
              href={`/admin/courses/${course.id}/sections`}
              className="block mt-3 text-center text-sm text-emerald-600 hover:underline"
            >
              จัดการ Sections 
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}