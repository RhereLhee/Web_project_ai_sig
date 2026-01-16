// app/(main)/dashboard/page.tsx
import { getUserWithSubscription } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getYouTubeEmbedUrl } from "@/lib/config"
import { TelegramFeed } from "@/components/TelegramFeed"
import { ForwardTestStats } from "./ForwardTestStats"

export default async function DashboardPage() {
  const user = await getUserWithSubscription()
  if (!user) redirect("/login")

  return (
    <div className="space-y-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <input
              type="text"
              placeholder="ค้นหา..."
              className="w-full px-4 py-2 pl-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        <Link 
          href="/pricing" 
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
        >
          อัพเกรด
        </Link>
      </div>

      {/* Hero Card with YouTube */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left - Text */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              ยินดีต้อนรับกลับมา
            </h1>
            <p className="text-gray-600 mb-4 leading-relaxed">
              เริ่มต้นการเทรดของคุณวันนี้ด้วยสัญญาณ AI ที่ผ่านการทดสอบจากตลาดจริง 
              ติดตามสถิติและผลตอบแทนแบบ Real-time
            </p>
            <Link 
              href="/signals" 
              className="inline-flex items-center px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition"
            >
              <span>ดู Signal</span>
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Right - YouTube Video */}
          <div className="relative rounded-lg overflow-hidden bg-gray-100">
            <div className="aspect-video">
              <iframe
                width="100%"
                height="100%"
                src={getYouTubeEmbedUrl('dashboardVideo')}
                title="TechTrade Tutorial"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              ></iframe>
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - Forward Test Stats (2 columns) */}
        <div className="lg:col-span-2">
          <ForwardTestStats />
        </div>

        {/* Right - Telegram Feed */}
        <div className="lg:col-span-1">
          <TelegramFeed />
        </div>
      </div>
    </div>
  )
}
