import Link from "next/link"
import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Course, Section, Video, CourseAccess, CourseType } from "@prisma/client"

// Prisma return type
type CourseWithSections = Course & {
  sections: (Section & {
    videos: Pick<Video, 'id'>[]
  })[]
}

async function getCourses(): Promise<CourseWithSections[]> {
  return await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { order: 'asc' },
    include: {
      sections: {
        include: {
          videos: {
            select: { id: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  })
}

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function CoursesPage({ searchParams }: Props) {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const hasSignal = hasSignalAccess(user)
  const isPartner = (user as any).isPartner || false
  const courses = await getCourses()

  // Await searchParams
  const params = await searchParams
  const tabParam = params.tab?.toUpperCase() || 'FREE'
  const currentTab: CourseAccess = ['FREE', 'PRO', 'PARTNER'].includes(tabParam) 
    ? tabParam as CourseAccess 
    : 'FREE'

  // Filter courses by access
  const filteredCourses = courses.filter(c => c.access === currentTab)

  // Separate by type
  const financeCourses = filteredCourses.filter(c => c.type === 'FINANCE')
  const tradingCourses = filteredCourses.filter(c => c.type === 'TRADING')

  // Check access
  const canAccessTab = (access: CourseAccess): boolean => {
    if (access === 'FREE') return true
    if (access === 'PRO') return hasSignal
    if (access === 'PARTNER') return isPartner
    return false
  }

  const hasAccess = canAccessTab(currentTab)

  // Tab labels
  const tabLabels: Record<CourseAccess, string> = {
    FREE: 'คอร์สเรียนฟรี สำหรับทุกคน',
    PRO: 'คอร์สพิเศษ สำหรับสมาชิก Signal',
    PARTNER: 'คอร์สพิเศษ สำหรับ Partner',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📚 ห้องเรียน</h1>
            <p className="text-sm text-gray-500">{tabLabels[currentTab]}</p>
          </div>
          {!hasAccess && (
            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
              🔒 ต้องอัพเกรด
            </span>
          )}
        </div>
      </div>

      {/* Locked State */}
      {!hasAccess && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {currentTab === 'PRO' ? 'คอร์สสำหรับสมาชิก Signal' : 'คอร์สสำหรับ Partner'}
          </h2>
          <p className="text-gray-500 mb-4">
            {currentTab === 'PRO' 
              ? 'ซื้อแพ็กเกจ Signal เพื่อเข้าถึงคอร์สเหล่านี้'
              : 'สมัครเป็น Partner เพื่อเข้าถึงคอร์สเหล่านี้'}
          </p>
          <Link 
            href={currentTab === 'PRO' ? '/signals' : '/partner'} 
            className="btn btn-primary"
          >
            {currentTab === 'PRO' ? 'ซื้อ Signal' : 'สมัคร Partner'}
          </Link>
        </div>
      )}

      {/* Course Content */}
      {hasAccess && (
        <>
          {/* Finance Courses Section */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">💰</span>
              หลักสูตรการเงิน
            </h2>
            
            {financeCourses.length > 0 ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {financeCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <p className="text-gray-500 text-sm">ยังไม่มีคอร์สในหมวดนี้</p>
              </div>
            )}
          </div>

          {/* Trading Courses Section */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <span className="mr-2">📈</span>
              หลักสูตรการเทรด
            </h2>
            
            {tradingCourses.length > 0 ? (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {tradingCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <p className="text-gray-500 text-sm">ยังไม่มีคอร์สในหมวดนี้</p>
              </div>
            )}
          </div>

          {/* Empty State */}
          {financeCourses.length === 0 && tradingCourses.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📚</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">ยังไม่มีคอร์สในหมวดนี้</h2>
              <p className="text-gray-500">กรุณากลับมาใหม่ภายหลัง</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Course Card Component
function CourseCard({ course }: { course: CourseWithSections }) {
  const totalVideos = course.sections.reduce((sum, s) => sum + s.videos.length, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-900 relative">
        {course.thumbnail ? (
          <img 
            src={course.thumbnail} 
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">
              {course.type === 'FINANCE' ? '💰' : '📈'}
            </span>
          </div>
        )}
        
        {/* Badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            course.access === 'FREE' 
              ? 'bg-emerald-500 text-white'
              : course.access === 'PRO'
              ? 'bg-amber-500 text-white'
              : 'bg-purple-500 text-white'
          }`}>
            {course.access}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{course.title}</h3>
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {course.description || 'เรียนรู้เทคนิคการเทรดแบบมืออาชีพ'}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            📹 {totalVideos} วิดีโอ
          </span>
          <Link 
            href={`/courses/${course.slug}`}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            เริ่มเรียน
          </Link>
        </div>
      </div>
    </div>
  )
}