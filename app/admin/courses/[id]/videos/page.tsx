import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import Link from "next/link"
import { VideoForm } from "./VideoForm"
import { VideoList } from "./VideoList"

interface Props {
  params: Promise<{ id: string }>
}

async function getCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sections: {
        include: {
          videos: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })

  return course
}

// ดึงหรือสร้าง Default Section
async function getOrCreateDefaultSection(courseId: string) {
  // หา section แรกของ course
  let section = await prisma.section.findFirst({
    where: { courseId },
    orderBy: { order: 'asc' },
  })

  // ถ้าไม่มี section ให้สร้างใหม่
  if (!section) {
    section = await prisma.section.create({
      data: {
        courseId,
        title: 'วิดีโอทั้งหมด',
        order: 1,
      },
    })
  }

  return section
}

export default async function CourseVideosPage({ params }: Props) {
  const { id } = await params
  const course = await getCourse(id)

  if (!course) {
    notFound()
  }

  // ดึง default section
  const defaultSection = await getOrCreateDefaultSection(id)

  // รวมวิดีโอทั้งหมดจากทุก section
  const allVideos = course.sections.flatMap(s => s.videos)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin/courses" className="hover:text-gray-700">คอร์ส</Link>
            <span>/</span>
            <Link href={`/admin/courses/${course.id}`} className="hover:text-gray-700">{course.title}</Link>
            <span>/</span>
            <span className="text-gray-900">วิดีโอ</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">จัดการวิดีโอ</h1>
          <p className="text-gray-500 text-sm mt-1">
            {course.title} • {allVideos.length} วิดีโอ
          </p>
        </div>
        <Link 
          href={`/admin/courses/${course.id}`} 
          className="text-gray-500 hover:text-gray-700"
        >
          กลับ
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form เพิ่มวิดีโอ */}
        <div className="lg:col-span-1">
          <VideoForm courseId={course.id} sectionId={defaultSection.id} />
        </div>

        {/* รายการวิดีโอ */}
        <div className="lg:col-span-2">
          <VideoList videos={allVideos} courseId={course.id} />
        </div>
      </div>
    </div>
  )
}