import { prisma } from "@/lib/prisma"
import { VideoUploadForm } from "./VideoUploadForm"

async function getCourses() {
  return await prisma.course.findMany({
    include: {
      sections: {
        include: { videos: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })
}

interface Props {
  searchParams: { course?: string }
}

export default async function AdminVideosPage({ searchParams }: Props) {
  const courses = await getCourses()
  const selectedCourse = searchParams.course 
    ? courses.find(c => c.id === searchParams.course)
    : courses[0]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">จัดการวิดีโอ</h1>
        <VideoUploadForm courses={courses} />
      </div>

      {/* Course Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium mb-2">เลือกคอร์ส</label>
        <div className="flex flex-wrap gap-2">
          {courses.map((course) => (
            <a
              key={course.id}
              href={`/admin/videos?course=${course.id}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCourse?.id === course.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {course.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections & Videos */}
      {selectedCourse ? (
        <div className="space-y-4">
          {selectedCourse.sections.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 mb-4">ยังไม่มี Section</p>
              <button className="btn btn-outline">+ เพิ่ม Section</button>
            </div>
          ) : (
            selectedCourse.sections.map((section, sIndex) => (
              <div key={section.id} className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">บทที่ {sIndex + 1}: {section.title}</h3>
                  <button className="btn btn-outline btn-sm">+ เพิ่มวิดีโอ</button>
                </div>

                {section.videos.length === 0 ? (
                  <p className="text-gray-500 text-sm">ยังไม่มีวิดีโอ</p>
                ) : (
                  <div className="space-y-2">
                    {section.videos.map((video, vIndex) => (
                      <div key={video.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <span className="w-8 h-8 rounded bg-emerald-100 flex items-center justify-center text-sm font-medium">
                            {vIndex + 1}
                          </span>
                          <div>
                            <p className="font-medium text-sm">{video.title}</p>
                            <p className="text-xs text-gray-500">
                              {video.duration ? `${Math.floor(video.duration / 60)} นาที` : 'ไม่ระบุ'}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button className="btn btn-outline btn-sm">แก้ไข</button>
                          <button className="btn btn-danger btn-sm">ลบ</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card text-center py-8">
          <p className="text-gray-500">เลือกคอร์สเพื่อจัดการวิดีโอ</p>
        </div>
      )}
    </div>
  )
}
