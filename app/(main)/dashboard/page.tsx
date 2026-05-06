// app/(main)/dashboard/page.tsx
import { getUserWithSubscription } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { TelegramFeed } from "@/components/TelegramFeed"
import { ForwardTestStats } from "./ForwardTestStats"
import { TopAffiliates } from "./TopAffiliates"

export default async function DashboardPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-gray-900 rounded-xl px-8 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <p className="text-gray-400 text-sm mb-1">ยินดีต้อนรับกลับมา</p>
          <h1 className="text-2xl font-bold text-white mb-2">
            {user.name || user.email}
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-md">
            สัญญาณ AI ที่ผ่านการทดสอบจากตลาดจริง — ติดตามผลและเทรดได้เลย
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/signals"
            className="inline-flex items-center px-5 py-2.5 bg-white text-gray-900 text-sm font-semibold rounded-lg hover:bg-gray-100 transition"
          >
            ดู Signal
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/partner"
            className="inline-flex items-center px-5 py-2.5 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-600 transition"
          >
            Partner
          </Link>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - Forward Test Stats (2 columns) */}
        <div className="lg:col-span-2">
          <ForwardTestStats />
        </div>

        {/* Right column - Telegram Feed + Top Affiliate */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <TelegramFeed />
          <TopAffiliates currentUserId={user.id} />
        </div>
      </div>
    </div>
  )
}
