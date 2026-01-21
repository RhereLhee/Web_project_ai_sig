import { notFound, redirect } from "next/navigation"
import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { SecureVideoPlayer } from "./SecureVideoPlayer"
import Link from "next/link"

async function getCourse(slug: string) {
  return await prisma.course.findUnique({
    where: { slug, isPublished: true },
    include: {
      sections: {
        include: { 
          videos: { 
            orderBy: { order: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              duration: true,
              order: true,
              // ไม่ส่ง videoId ไป Client!
            },
          } 
        },
        orderBy: { order: 'asc' },
      },
    },
  })
}

async function getUserProgress(userId: string, videoIds: string[]) {
  if (videoIds.length === 0) return []
  
  return await prisma.userProgress.findMany({
    where: { userId, videoId: { in: videoIds } },
  })
}

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ v?: string }>
}

export default async function CoursePage({ params, searchParams }: Props) {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const { slug } = await params
  const { v: videoIndex } = await searchParams

  const course = await getCourse(slug)
  if (!course) notFound()

  // ตรวจสอบสิทธิ์การเข้าถึง
  const hasSignal = hasSignalAccess(user)
  const isPartner = user.partner?.status === 'ACTIVE'

  const canAccess = 
    course.access === 'FREE' ||
    (course.access === 'PRO' && hasSignal) ||
    (course.access === 'PARTNER' && isPartner) ||
    user.role === 'ADMIN'

  if (!canAccess) {
    redirect(`/courses?tab=${course.access.toLowerCase()}`)
  }

  // รวมวิดีโอทั้งหมด (ไม่มี videoId - ซ่อนไว้)
  const allVideos = course.sections.flatMap(s => s.videos)
  const videoIds = allVideos.map(v => v.id)

  // ดึง Progress
  const progress = await getUserProgress(user.id, videoIds)
  const progressMap = new Map(progress.map(p => [p.videoId, p]))

  // หาวิดีโอปัจจุบันจาก index (v=1, v=2, ...)
  let currentIndex = 0
  if (videoIndex) {
    const idx = parseInt(videoIndex) - 1 // v=1 → index 0
    if (idx >= 0 && idx < allVideos.length) {
      currentIndex = idx
    }
  }

  const currentVideo = allVideos[currentIndex]

  // คำนวณ Progress
  const totalVideos = allVideos.length
  const completedVideos = progress.filter(p => p.completed).length
  const courseProgress = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <Link href="/courses" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-block">
              ← กลับไปรายการคอร์ส
            </Link>
            <h1 className="text-xl font-bold text-gray-900">{course.title}</h1>
            {course.description && (
              <p className="text-sm text-gray-500 mt-1">{course.description}</p>
            )}
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              course.access === 'FREE' ? 'bg-emerald-100 text-emerald-700' :
              course.access === 'PRO' ? 'bg-blue-100 text-blue-700' :
              'bg-purple-100 text-purple-700'
            }`}>
              {course.access}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500">ความคืบหน้า</span>
            <span className="font-medium">{completedVideos}/{totalVideos} วิดีโอ ({courseProgress}%)</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${courseProgress}%` }}
            />
          </div>
        </div>
      </div>

      {allVideos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎬</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">ยังไม่มีวิดีโอ</h2>
          <p className="text-gray-500">คอร์สนี้ยังไม่มีเนื้อหา กรุณากลับมาใหม่ภายหลัง</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content - Video Player */}
          <div className="lg:col-span-2">
            {currentVideo && (
              <SecureVideoPlayer
                videoDbId={currentVideo.id}
                title={currentVideo.title}
                description={currentVideo.description}
                duration={currentVideo.duration}
                isCompleted={progressMap.get(currentVideo.id)?.completed || false}
                prevIndex={currentIndex > 0 ? currentIndex : null}
                nextIndex={currentIndex < allVideos.length - 1 ? currentIndex + 2 : null}
                courseSlug={course.slug}
                totalVideos={allVideos.length}
                currentIndex={currentIndex + 1}
              />
            )}
          </div>

          {/* Sidebar - Video List (ไม่มี Thumbnail เพื่อซ่อน Video ID) */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="font-semibold text-gray-900">📹 รายการวิดีโอ</h2>
              <p className="text-sm text-gray-500">{totalVideos} วิดีโอ</p>
            </div>

            <div className="divide-y max-h-[600px] overflow-y-auto">
              {allVideos.map((video, index) => {
                const videoProgress = progressMap.get(video.id)
                const isActive = currentIndex === index
                const isCompleted = videoProgress?.completed

                return (
                  <Link
                    key={video.id}
                    href={`/courses/${course.slug}?v=${index + 1}`}
                    className={`flex items-center p-3 hover:bg-gray-50 transition-colors ${
                      isActive ? 'bg-emerald-50 border-l-4 border-emerald-500' : ''
                    }`}
                  >
                    {/* Number / Check */}
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 mr-3 ${
                      isCompleted 
                        ? 'bg-emerald-500 text-white' 
                        : isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isCompleted ? '✓' : index + 1}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'font-medium text-emerald-700' : 'text-gray-900'}`}>
                        {video.title}
                      </p>
                      {video.duration && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {Math.floor(video.duration / 60)} นาที
                        </p>
                      )}
                    </div>

                    {/* Playing indicator */}
                    {isActive && (
                      <span className="text-emerald-500 text-sm ml-2">▶</span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}