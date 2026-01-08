import Link from "next/link"
import { SITE_CONFIG } from "@/lib/config"

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Copyright */}
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} {SITE_CONFIG.siteName}. All rights reserved.
          </p>

          {/* Links */}
          <div className="flex items-center space-x-6 text-sm">
            <a 
              href="/docs/privacy-policy.pdf" 
              target="_blank"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              นโยบายความเป็นส่วนตัว
            </a>
            <a 
              href="/docs/partner-terms.pdf" 
              target="_blank"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              เงื่อนไข Partner
            </a>
            <a 
              href="/docs/signal-terms.pdf" 
              target="_blank"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              เงื่อนไข Signal
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}