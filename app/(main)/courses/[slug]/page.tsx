import { notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/getSession"
import { prisma } from "@/lib/prisma"
import { VideoPlayer } from "./VideoPlayer"

async function getCourse(slug: string) {
  return await prisma.course.findUnique({
    where: { slug },
    include: {
      sections: {
        include: { videos: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
    },
  })
}

async function getUserProgress(userId: string, courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { sections: { include: { videos: true } } },
  })

  if (!course) return []

  const videoIds = course.sections.flatMap(s => s.videos.map(v => v.id))

  return await prisma.userProgress.findMany({
    where: { userId, videoId: { in: videoIds } },
  })
}

interface Props {
  params: { slug: string }
  searchParams: { video?: string }
}

export default async function CoursePage({ params, searchParams }: Props) {
  const user = await getCurrentUser()
  if (!user) notFound()

  const course = await getCourse(params.slug)
  if (!course) notFound()

  const progress = await getUserProgress(user.id, course.id)
  const progressMap = new Map(progress.map(p => [p.videoId, p]))

  // Find current video
  let currentVideo = course.sections[0]?.videos[0]
  if (searchParams.video) {
    for (const section of course.sections) {
      const found = section.videos.find(v => v.id === searchParams.video)
      if (found) {
        currentVideo = found
        break
      }
    }
  }

  const totalVideos = course.sections.reduce((sum, s) => sum + s.videos.length, 0)
  const completedVideos = progress.filter(p => p.completed).length
  const courseProgress = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Main Content */}
      <div className="lg:col-span-2">
        <div className="card p-0 overflow-hidden">
          {/* Video Player */}
          {currentVideo && (
            <VideoPlayer
              video={currentVideo}
              userId={user.id}
              progress={progressMap.get(currentVideo.id)}
            />
          )}
        </div>

        {/* Course Info */}
        <div className="card mt-4">
          <h1 className="text-xl font-bold mb-2">{course.title}</h1>
          {course.description && (
            <p className="text-gray-600">{course.description}</p>
          )}
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span>ความคืบหน้า</span>
              <span>{courseProgress}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${courseProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Video List */}
      <div className="card p-0 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="font-semibold">เนื้อหาคอร์ส</h2>
          <p className="text-sm text-gray-500">
            {completedVideos}/{totalVideos} บทเรียน
          </p>
        </div>

        <div className="divide-y max-h-[600px] overflow-y-auto">
          {course.sections.map((section, sIndex) => (
            <div key={section.id}>
              <div className="p-3 bg-gray-50 font-medium text-sm">
                บทที่ {sIndex + 1}: {section.title}
              </div>
              {section.videos.map((video, vIndex) => {
                const videoProgress = progressMap.get(video.id)
                const isActive = currentVideo?.id === video.id
                const isCompleted = videoProgress?.completed

                return (
                  <a
                    key={video.id}
                    href={`/courses/${course.slug}?video=${video.id}`}
                    className={`flex items-center p-3 hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 ${
                      isCompleted 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {isCompleted ? '✓' : vIndex + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'font-medium' : ''}`}>
                        {video.title}
                      </p>
                      {video.duration && (
                        <p className="text-xs text-gray-400">
                          {Math.floor(video.duration / 60)} นาที
                        </p>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
