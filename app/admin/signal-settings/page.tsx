// app/admin/signals/page.tsx
import { getForwardStats, getSymbolSettings } from "@/lib/trading-api"
import { SignalControlCard } from "./SignalControlCard"
import { QuickActions } from "./QuickActions"

export default async function AdminSignalsPage() {
  // ดึงข้อมูลจาก Python API (server-side)
  const [forwardStats, symbolSettings] = await Promise.all([
    getForwardStats(),
    getSymbolSettings(),
  ])

  // รวมข้อมูล
  const symbolsData = forwardStats.map((stat) => {
    const setting = symbolSettings.find((s) => s.symbol === stat.symbol)
    return {
      ...stat,
      enabled: setting?.enabled ?? true,
      threshold: setting?.threshold ?? 0.82,
      notes: setting?.notes,
    }
  })

  // Overall stats
  const totalSequences = forwardStats.reduce((sum, s) => sum + s.total_sequences, 0)
  const totalWins = forwardStats.reduce((sum, s) => sum + s.winning_sequences, 0)
  const totalLosses = forwardStats.reduce((sum, s) => sum + s.losing_sequences, 0)
  const overallWinRate = totalSequences > 0 ? (totalWins / totalSequences * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎛️ จัดการ AI Signal</h1>
          <p className="text-gray-500">ควบคุม Signal และ Retrain Model</p>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Win Rate รวม</p>
          <p className={`text-2xl font-bold ${overallWinRate >= 90 ? 'text-emerald-600' : 'text-yellow-600'}`}>
            {overallWinRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Total Sequences</p>
          <p className="text-2xl font-bold text-gray-800">{totalSequences}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Win</p>
          <p className="text-2xl font-bold text-green-600">{totalWins}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-sm text-gray-500">Loss</p>
          <p className="text-2xl font-bold text-red-500">{totalLosses}</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-800 mb-2">ℹ️ วิธีใช้งาน</h2>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>ปิด Signal</strong> = หยุดส่ง Signal ของคู่เงินนั้นไปยัง Users</li>
          <li>• <strong>Retrain</strong> = ส่งคำสั่งให้ VPS เทรน Model ใหม่ (ใช้เวลา ~10-30 นาที)</li>
          <li>• <strong>Threshold</strong> = ความมั่นใจขั้นต่ำในการส่ง Signal (ค่ามาก = เข้มงวด)</li>
          <li>• ข้อมูล Forward Test อัปเดตอัตโนมัติจาก VPS</li>
        </ul>
      </div>

      {/* Signal Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {symbolsData.map((data) => (
          <SignalControlCard key={data.symbol} data={data} />
        ))}
      </div>

      {/* Quick Actions */}
      <QuickActions symbols={symbolsData.map(s => s.symbol)} />
    </div>
  )
}
