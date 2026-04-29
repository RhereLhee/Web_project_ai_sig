'use client'

import { useState, useEffect, useCallback } from 'react'

interface LogEntry {
  level: string
  message: string
  context?: string
  userId?: string
  errorMessage?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

interface LogStats {
  total: number
  byLevel: Record<string, number>
  byContext: Record<string, number>
}

interface HealthCheck {
  status: string
  checks: Record<string, string>
}

function ErrorModal({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <span className="font-semibold text-gray-900">Error Detail</span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all bg-red-50 p-4 rounded-lg">
            {text}
          </pre>
        </div>
        <div className="px-5 py-3 border-t flex justify-end">
          <button
            onClick={() => navigator.clipboard?.writeText(text)}
            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg mr-2"
          >
            Copy
          </button>
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-900 text-white text-sm rounded-lg">
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [stats, setStats] = useState<LogStats | null>(null)
  const [health, setHealth] = useState<HealthCheck | null>(null)
  const [filter, setFilter] = useState({ level: '', context: '' })
  const [loading, setLoading] = useState(true)
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter.level) params.set('level', filter.level)
      if (filter.context) params.set('context', filter.context)
      params.set('limit', '200')

      const res = await fetch(`/api/admin/logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setStats(data.stats)
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health')
      if (res.ok) {
        setHealth(await res.json())
      } else {
        setHealth({ status: 'error', checks: {} })
      }
    } catch {
      setHealth({ status: 'unreachable', checks: {} })
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchHealth()
  }, [fetchLogs, fetchHealth])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs()
      fetchHealth()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchLogs, fetchHealth])

  const levelColors: Record<string, string> = {
    info: 'bg-blue-100 text-blue-800',
    warn: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    fatal: 'bg-red-600 text-white',
  }

  return (
    <div>
      {expandedError && (
        <ErrorModal text={expandedError} onClose={() => setExpandedError(null)} />
      )}

      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">System Logs</h1>
        <button
          onClick={() => { fetchLogs(); fetchHealth() }}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Health Status */}
      <div className="mb-6 p-4 rounded-lg border bg-white">
        <h2 className="text-lg font-semibold mb-3">System Health</h2>
        {health ? (
          <div className="flex gap-4 flex-wrap">
            <div className={`px-4 py-2 rounded-lg font-bold ${
              health.status === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              Status: {health.status}
            </div>
            {Object.entries(health.checks).map(([key, value]) => (
              <div key={key} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700">
                {key}: {value}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Loading...</p>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-gray-500 text-sm">Total Logs</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.byLevel.info || 0}</div>
            <div className="text-gray-500 text-sm">Info</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-yellow-600">{stats.byLevel.warn || 0}</div>
            <div className="text-gray-500 text-sm">Warning</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-red-600">{stats.byLevel.error || 0}</div>
            <div className="text-gray-500 text-sm">Error</div>
          </div>
          <div className="p-4 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-red-800">{stats.byLevel.fatal || 0}</div>
            <div className="text-gray-500 text-sm">Fatal</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filter.level}
          onChange={(e) => setFilter(f => ({ ...f, level: e.target.value }))}
          className="px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">ทุกระดับ</option>
          <option value="info">Info</option>
          <option value="warn">Warning</option>
          <option value="error">Error</option>
          <option value="fatal">Fatal</option>
        </select>

        <select
          value={filter.context}
          onChange={(e) => setFilter(f => ({ ...f, context: e.target.value }))}
          className="px-3 py-2 border rounded-lg bg-white"
        >
          <option value="">ทุก Context</option>
          <option value="auth">Auth (Login)</option>
          <option value="register">Register (สมัครสมาชิก)</option>
          <option value="payment">Payment</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="signal">Signal</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ยังไม่มี log (log จะเริ่มเก็บเมื่อมี request เข้ามา)
          </div>
        ) : (
          <>
            {/* Mobile card list */}
            <div className="md:hidden divide-y">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={`p-3 space-y-1 ${log.level === 'fatal' || log.level === 'error' ? 'bg-red-50/60' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${levelColors[log.level] || 'bg-gray-100'}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      {new Date(log.timestamp).toLocaleString('th-TH')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 rounded px-1.5 py-0.5">{log.context || '-'}</span>
                  </div>
                  <p className="text-sm text-gray-800 break-words">{log.message}</p>
                  {log.errorMessage && (
                    <button
                      onClick={() => setExpandedError(log.errorMessage!)}
                      className="text-left text-red-600 text-xs font-mono break-all hover:underline w-full"
                    >
                      ⚠ {log.errorMessage.substring(0, 100)}{log.errorMessage.length > 100 ? '…' : ''}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">เวลา</th>
                  <th className="px-4 py-3 text-left">Level</th>
                  <th className="px-4 py-3 text-left">Context</th>
                  <th className="px-4 py-3 text-left">Message</th>
                  <th className="px-4 py-3 text-left">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log, i) => (
                  <tr key={i} className={log.level === 'fatal' ? 'bg-red-50' : log.level === 'error' ? 'bg-red-50/50' : ''}>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString('th-TH')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${levelColors[log.level] || 'bg-gray-100'}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{log.context || '-'}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <span className="block truncate" title={log.message}>{log.message}</span>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {log.errorMessage ? (
                        <button
                          onClick={() => setExpandedError(log.errorMessage!)}
                          className="text-left text-red-600 text-xs font-mono truncate block max-w-[200px] hover:text-red-800 hover:underline cursor-pointer"
                          title="คลิกเพื่อดูข้อความเต็ม"
                        >
                          {log.errorMessage.substring(0, 80)}{log.errorMessage.length > 80 ? '…' : ''}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Setup Guide */}
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border">
        <h2 className="text-lg font-semibold mb-3">วิธีตั้งค่าการแจ้งเตือนเว็บล่ม</h2>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900">1. Email Alert (ตั้งค่าแล้ว)</h3>
            <p>Error/Fatal จะส่งแจ้งเตือนไปที่ ALERT_EMAIL อัตโนมัติ (throttled 5 นาที/context) — ถ้า error เดิมซ้ำหลายครั้งจะแสดงจำนวนครั้งในอีเมลเดียว</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">2. UptimeRobot (แนะนำ - ฟรี)</h3>
            <p>ไปที่ <span className="font-mono bg-gray-200 px-1 rounded">uptimerobot.com</span> สร้าง Monitor ชี้มาที่:</p>
            <code className="block bg-gray-900 text-green-400 p-3 rounded mt-2">
              {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/health
            </code>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">3. Render Health Check (ถ้าใช้ Render)</h3>
            <p>Render Dashboard &gt; Service &gt; Settings &gt; Health Check Path: <span className="font-mono bg-gray-200 px-1 rounded">/api/health</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
