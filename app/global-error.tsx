'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error.message || 'Unknown client error',
        stack: error.stack?.substring(0, 1000),
        digest: error.digest,
        url: window.location.href,
        userAgent: navigator.userAgent.substring(0, 200),
      }),
    }).catch(() => {})
  }, [error])

  return (
    <html lang="th">
      <body>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5C2.3 18.333 3.26 20 4.8 20z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">เกิดข้อผิดพลาด</h1>
            <p className="text-gray-500 text-sm mb-6">
              ระบบพบปัญหาบางอย่าง ทีมงานได้รับแจ้งแล้วและกำลังดำเนินการแก้ไข
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition-colors"
              >
                ลองใหม่
              </button>
              <a
                href="/"
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                กลับหน้าหลัก
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
