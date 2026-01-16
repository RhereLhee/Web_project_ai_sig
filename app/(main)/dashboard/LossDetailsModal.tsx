// app/(main)/dashboard/LossDetailsModal.tsx
"use client"

import { useState } from "react"

interface LossDetailsModalProps {
  losses: number
}

export function LossDetailsModal({ losses }: LossDetailsModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lossDetails, setLossDetails] = useState<any[]>([])

  const handleOpen = async () => {
    setIsOpen(true)
    setLoading(true)
    
    try {
      const res = await fetch('/api/trading/losses')
      if (res.ok) {
        const data = await res.json()
        setLossDetails(data.losses || [])
      }
    } catch (error) {
      console.error('Failed to fetch loss details')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition"
      >
        ดูรายละเอียด
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">รายการที่แพ้ทั้งหมด</h2>
                <p className="text-sm text-gray-500">{losses} sequences ที่ครบ 3 ไม้แล้วแพ้</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : lossDetails.length > 0 ? (
                <div className="space-y-3">
                  {lossDetails.map((loss, index) => (
                    <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{loss.symbol}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            loss.signal_type === 'CALL' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {loss.signal_type}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">{loss.entry_time}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">ใช้ไป {loss.trades_used} ไม้</span>
                        <span className="font-medium text-red-600">{loss.total_profit} $</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>ไม่มีข้อมูลรายละเอียด</p>
                  <p className="text-sm mt-2">ข้อมูลจะถูกบันทึกเมื่อมีการเทรดจริง</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                💡 Loss เกิดเมื่อ sequence ครบ 3 ไม้แล้วยังแพ้ - ควรพิจารณา retrain model
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
