import Link from "next/link"
import { TrendingUp } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-black" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                TechTrade
              </span>
            </Link>
            <p className="text-sm text-gray-400">
              ระบบ Signal Trading อัจฉริยะ พร้อมห้องเรียนการเทรดและการเงิน
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">บริการ</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/signals" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  Signal Trading
                </Link>
              </li>
              <li>
                <Link href="/courses" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  ห้องเรียน
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  ราคาแพ็กเกจ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">เกี่ยวกับ</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  เกี่ยวกับเรา
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  ติดต่อเรา
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  คำถามที่พบบ่อย
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">นโยบาย</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  ข้อกำหนดการใช้งาน
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  นโยบายความเป็นส่วนตัว
                </Link>
              </li>
              <li>
                <Link href="/refund" className="text-sm text-gray-400 hover:text-emerald-400 transition-colors">
                  นโยบายคืนเงิน
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © 2024 TechTrade. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">
            การเทรดมีความเสี่ยง ผลการดำเนินงานในอดีตไม่ได้รับประกันผลในอนาคต
          </p>
        </div>
      </div>
    </footer>
  )
}
