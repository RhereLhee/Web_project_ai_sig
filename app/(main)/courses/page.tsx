import { getUserWithSubscription, hasSignalAccess } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"

const ACCESS_CONFIG: Record<string, { label: string; color: string }> = {
  FREE:    { label: "สมาชิกทั่วไป",  color: "text-amber-400" },
  PRO:     { label: "Signal VIP",     color: "text-emerald-400" },
  PARTNER: { label: "Partner",        color: "text-blue-400" },
}

const TYPE_CONFIG: Record<string, string> = {
  TRADING: "การเทรด",
  FINANCE: "การเงิน",
}

function CourseCard({ course, canAccess }: {
  course: {
    id: string
    title: string
    slug: string
    description: string | null
    access: string
    type: string
    thumbnail: string | null
  }
  canAccess: boolean
}) {
  const acc = ACCESS_CONFIG[course.access] ?? { label: course.access, color: "text-gray-400" }

  const card = (
    <div className={`bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm transition-shadow ${canAccess ? 'hover:shadow-md' : 'opacity-75'}`}>
      {/* Thumbnail */}
      <div className="relative h-44 bg-gray-900 flex flex-col items-center justify-center px-6 select-none">
        {/* Brand name */}
        <p className="text-white text-2xl font-bold tracking-wide mb-1">TechTrade</p>

        {/* Access level */}
        <p className={`text-sm font-semibold ${acc.color}`}>{acc.label}</p>

        {/* Course type */}
        <p className="text-gray-400 text-xs mt-0.5">{TYPE_CONFIG[course.type] ?? course.type}</p>

        {/* Lock badge */}
        {!canAccess && (
          <div className="absolute top-3 right-3 bg-black/60 rounded-full p-1.5">
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}

        {/* Bottom logo mark */}
        <div className="absolute bottom-3 flex items-center gap-1.5">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="text-emerald-500 text-[11px] font-semibold tracking-wider">TECHTRADE</span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-1">{course.title}</h3>
        {course.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{course.description}</p>
        )}
        {!canAccess && (
          <p className="text-xs text-amber-600 mt-2">
            ต้องการสิทธิ์ {acc.label}
          </p>
        )}
      </div>
    </div>
  )

  if (!canAccess) return <div>{card}</div>

  return <Link href={`/courses/${course.slug}`}>{card}</Link>
}

export default async function CoursesPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  const hasSignal = hasSignalAccess(user)
  const hasPartner = (user as any).partner?.status === "ACTIVE"

  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    select: {
      id: true, title: true, slug: true,
      description: true, access: true, type: true, thumbnail: true,
    },
    orderBy: { order: "asc" },
  })

  function canAccess(access: string) {
    if (access === "FREE") return true
    if (access === "PRO" && hasSignal) return true
    if (access === "PARTNER" && hasPartner) return true
    return false
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h1 className="text-xl font-bold text-gray-900">ห้องเรียน</h1>
        <p className="text-sm text-gray-500 mt-1">คอร์สสำหรับสมาชิก TechTrade</p>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-400 text-sm">ยังไม่มีคอร์สเปิดให้บริการ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} canAccess={canAccess(course.access)} />
          ))}
        </div>
      )}
    </div>
  )
}
