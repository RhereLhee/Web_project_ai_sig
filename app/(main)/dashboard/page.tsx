import { getUserWithSubscription } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { getYouTubeEmbedUrl } from "@/lib/config"
import { TelegramFeed } from "@/components/TelegramFeed"

const tradingWarnings = [
  "อย่าลงทุนเกินกว่าที่คุณสามารถรับความเสี่ยงได้",
  "ใช้ Stop Loss ทุกครั้งเพื่อจำกัดความเสียหาย",
  "อย่า Martingale เกิน Level 3 ในสถานการณ์ปกติ",
  "ตรวจสอบ Market Condition ก่อนเข้า Position",
]

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
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
        <Link href="/pricing" className="btn btn-primary">
          อัพเกรด
        </Link>
      </div>

      {/* Hero Card with YouTube */}
      <div className="card">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left - Text */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              ยินดีต้อนรับกลับมา
            </h1>
            <p className="text-gray-600 mb-2">
              เริ่มต้นการเทรดของคุณวันนี้ด้วยสัญญาณ AI ที่แม่นยำ
            </p>
            <p className="text-gray-600 mb-6">
              ติดตามสถิติและผลตอบแทนของคุณแบบ Real-time
            </p>
            <Link href="/signals" className="btn btn-primary inline-block">
              ดู Signal
            </Link>
          </div>

          {/* Right - YouTube Video */}
          <div className="relative rounded-xl overflow-hidden shadow-lg">
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

      {/* Section Title */}
      <h2 className="text-2xl font-bold text-gray-900">คำเตือน</h2>

      {/* Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left - Trading Warnings (2 columns) */}
        <div className="lg:col-span-2">
          <div className="card bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="flex items-start space-x-3 mb-6">
              <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-amber-900 mb-2">
                  ข้อควรระวังสำหรับนักเทรด
                </h3>
                <p className="text-sm text-amber-800">
                  โปรดอ่านและปฏิบัติตามเพื่อความปลอดภัยในการเทรด
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {tradingWarnings.map((warning, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <svg
                    className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-gray-800 leading-relaxed">{warning}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-start space-x-2 p-4 bg-amber-100 rounded-lg">
              <span className="text-lg">💡</span>
              <p className="text-sm text-amber-900 font-medium">
                สำคัญ: การเทรดมีความเสี่ยง กรุณาศึกษาและเข้าใจก่อนลงทุน
              </p>
            </div>
          </div>
        </div>

        {/* Right - Telegram Feed (Client Component) */}
        <div className="lg:col-span-1">
          <TelegramFeed />
        </div>
      </div>
    </div>
  )
}