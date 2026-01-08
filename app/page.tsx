import Link from "next/link"
import Image from "next/image"
import { getSocialLink, getYouTubeEmbedUrl } from "@/lib/config"

export default function LandingPage() {
  const features = [
    {
      title: "Signal AI Real-time",
      description: "รับสัญญาณการเทรดจาก AI ที่มีความแม่นยำสูง",
    },
    {
      title: "คอร์สเทรดขั้นสูง",
      description: "เรียนรู้เทคนิคการเทรดจากผู้เชี่ยวชาญ",
    },
    {
      title: "Affiliate Commission",
      description: "รับค่าคอมมิชชั่นจากการแนะนำเพื่อน",
    },
    {
      title: "เครื่องมือวิเคราะห์",
      description: "เครื่องมือช่วยวิเคราะห์ตลาดอย่างมืออาชีพ",
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Image
                src="/logo.png"
                alt="TechTrade"
                width={180}
                height={50}
                className="h-10 w-auto object-contain"
                priority
              />
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-700 hover:text-gray-900 font-medium">
                สิ่งที่จะได้รับ
              </a>
              <a href="#about" className="text-gray-700 hover:text-gray-900 font-medium">
                เกี่ยวกับเรา
              </a>
            </nav>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 hover:text-gray-900 font-medium"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/register"
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
              >
                ลงทะเบียน
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text */}
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                เทรดอย่างมืออาชีพ<br />
                ด้วย AI Signal
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                รับสัญญาณการเทรดที่แม่นยำจาก AI พร้อมคอร์สเรียนและเครื่องมือวิเคราะห์ครบครัน
              </p>
              <div className="flex space-x-4">
                <Link
                  href="/register"
                  className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700 transition-colors font-semibold text-lg"
                >
                  เริ่มต้นใช้งาน
                </Link>
                <Link
                  href="/login"
                  className="border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg hover:border-gray-400 transition-colors font-semibold text-lg"
                >
                  เข้าสู่ระบบ
                </Link>
              </div>
            </div>

            {/* Right - YouTube Video */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={getYouTubeEmbedUrl('introVideo')}
                  title="TechTrade Introduction"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                ></iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">สิ่งที่จะได้รับ</h2>
            <p className="text-xl text-gray-600">ทุกสิ่งที่คุณต้องการสำหรับการเทรดที่ประสบความสำเร็จ</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <div key={i} className="bg-white border-2 border-gray-200 rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-emerald-100 rounded-lg flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 text-lg">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discord + Telegram Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">ติดตามสถิติ Signal</h2>
            <p className="text-xl text-gray-600">เลือกช่องทางที่คุณสะดวก</p>
          </div>

          <div className="flex justify-center gap-16">
            {/* Discord */}
            <a
              href={getSocialLink('discord')}
              target="_blank"
              rel="noopener noreferrer"
              className="group text-center"
            >
              <div className="w-40 h-40 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg mx-auto">
                <svg className="w-20 h-20 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Discord</h3>
              <p className="text-gray-600">discord.gg/techtrade</p>
            </a>

            {/* Telegram */}
            <a
              href={getSocialLink('telegram')}
              target="_blank"
              rel="noopener noreferrer"
              className="group text-center"
            >
              <div className="w-40 h-40 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg mx-auto">
                <svg className="w-20 h-20 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z"/>
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">Telegram</h3>
              <p className="text-gray-600">t.me/techtrade_stats</p>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-400">
            <p>© 2026 TechTrade. All rights reserved.</p>
            <a href="/privacy-policy" className="text-emerald-400 hover:text-emerald-300 transition-colors mt-2 sm:mt-0">
              Privacy policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}