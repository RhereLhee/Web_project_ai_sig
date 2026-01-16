// app/(main)/dashboard/ForwardTestStats.tsx
// ดึงข้อมูลจริงจาก Supabase

import { getOverallStats, getStatsByPeriod, getStatsBySymbol } from "@/lib/forward-test"

export async function ForwardTestStats() {
  // ดึงข้อมูลจริงจาก Database
  const [overall, stats3d, stats7d, symbolStats] = await Promise.all([
    getOverallStats(),
    getStatsByPeriod(3),
    getStatsByPeriod(7),
    getStatsBySymbol(),
  ])

  // ถ้าไม่มีข้อมูล แสดง placeholder
  if (!overall || overall.totalSequences === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500">กำลังรอข้อมูล Forward Test...</p>
          <p className="text-sm text-gray-400 mt-2">ข้อมูลจะอัปเดตเมื่อมีการเทรด</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Main Stats Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">ผลการทดสอบ AI Signal</h3>
            <p className="text-sm text-gray-500">Forward Test - ข้อมูลจริงจากตลาด</p>
          </div>
        </div>

        {/* Main Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{overall.winRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500 mt-1">Win Rate รวม</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{overall.totalSequences}</p>
            <p className="text-sm text-gray-500 mt-1">จำนวนไม้ทั้งหมด</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{overall.winningSequences}</p>
            <p className="text-sm text-gray-500 mt-1">ชนะ</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{overall.losingSequences}</p>
            <p className="text-sm text-gray-500 mt-1">แพ้</p>
          </div>
        </div>

        {/* Period Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">3 วันล่าสุด</span>
              <span className="text-xs text-gray-400">{stats3d.totalSequences} trades</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats3d.winRate.toFixed(1)}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">7 วันล่าสุด</span>
              <span className="text-xs text-gray-400">{stats7d.totalSequences} trades</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats7d.winRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Disclaimer - Short */}
        <p className="text-xs text-gray-400 text-center">
          ผลการดำเนินงานในอดีตไม่สามารถรับประกันผลในอนาคต
        </p>
      </div>

      {/* Per Symbol Stats */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h4 className="text-sm font-medium text-gray-900 mb-4">สถิติแยกตามคู่เงิน</h4>
        <div className="space-y-3">
          {symbolStats.map((stat) => (
            <div key={stat.symbol} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-400 w-10">{getSymbolCode(stat.symbol)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{formatSymbolName(stat.symbol)}</p>
                  <p className="text-xs text-gray-400">{stat.totalSequences} sequences</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{stat.winRate.toFixed(1)}%</p>
                  <p className="text-xs text-gray-400">{stat.winningSequences}W / {stat.losingSequences}L</p>
                </div>
                <div className={`w-1.5 h-8 rounded-full ${getWinRateColor(stat.winRate)}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loss Summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900">รายการที่แพ้</h4>
            <p className="text-xs text-gray-400">{overall.losingSequences} sequences ที่ครบ 3 ไม้</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {symbolStats.map((stat) => (
            <div key={stat.symbol} className="text-center py-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">{formatSymbolName(stat.symbol)}</p>
              <p className="text-lg font-semibold text-gray-900">{stat.losingSequences}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Disclosure Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
        <h4 className="text-sm font-medium text-gray-700 mb-4">ข้อมูลสำคัญ</h4>
        
        <div className="space-y-4 text-xs text-gray-500 leading-relaxed">
          <p>
            ข้อมูลผลการดำเนินงานที่แสดงบนเว็บไซต์นี้เป็นผลลัพธ์จากการทดสอบแบบ Forward Test (การใช้งานจริง) เท่านั้น 
            ข้อมูลดังกล่าวถูกรวบรวมและแสดงผลตามลำดับเวลาโดยไม่มีการปรับแต่ง คัดเลือก หรือแก้ไขย้อนหลัง
          </p>
          
          <p>
            อัตราความสำเร็จ (Win Rate) อาจมีความผันผวนตามสภาวะตลาดในแต่ละช่วงเวลา 
            ซึ่งเป็นลักษณะปกติของระบบการซื้อขายที่ใช้งานจริง ในบางช่วงเวลา ระบบอาจมีประสิทธิภาพสูงกว่าค่าเฉลี่ย 
            และในบางช่วงเวลาอาจต่ำกว่าค่าเฉลี่ย
          </p>

          <p>
            ระบบของเราใช้แบบจำลองปัญญาประดิษฐ์ที่ได้รับการพัฒนาและฝึกฝนจากข้อมูลตลาดย้อนหลังหลายปี 
            โดยมีการปรับปรุงและฝึกฝนโมเดลใหม่ (Retraining) เป็นระยะทุก 30 วัน 
            เพื่อให้สามารถปรับตัวต่อการเปลี่ยนแปลงของสภาวะตลาดในปัจจุบันได้อย่างเหมาะสม
          </p>

          <div className="pt-4 border-t border-gray-200">
            <p className="font-medium text-gray-600">
              ผลการดำเนินงานในอดีตไม่สามารถใช้เป็นหลักประกันหรือรับรองผลการดำเนินงานในอนาคตได้ 
              การลงทุนมีความเสี่ยง ผู้ใช้งานควรพิจารณาข้อมูลอย่างรอบคอบก่อนตัดสินใจ
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function getSymbolCode(symbol: string): string {
  const codes: Record<string, string> = {
    'AUDUSDm': 'AUUS',
    'EURUSDm': 'EUUS',
    'GBPUSDm': 'GBUS',
    'USDJPYm': 'USJP',
  }
  return codes[symbol] || symbol.slice(0, 4)
}

function formatSymbolName(symbol: string): string {
  const clean = symbol.replace(/m$/i, '')
  return `${clean.slice(0, 3)}/${clean.slice(3)}`
}

function getWinRateColor(winRate: number): string {
  if (winRate >= 92) return 'bg-emerald-500'
  if (winRate >= 88) return 'bg-emerald-400'
  if (winRate >= 85) return 'bg-yellow-400'
  return 'bg-orange-400'
}
