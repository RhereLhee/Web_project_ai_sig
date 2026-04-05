'use client'

import { useState, useEffect, useCallback } from 'react'

interface SystemSettings {
  free_trial_enabled: boolean
  free_trial_days: number
  affiliate_enabled: boolean
}

export default function AdminSystemPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    free_trial_enabled: true,
    free_trial_days: 30,
    affiliate_enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/system')
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSetting = async (key: string, value: unknown) => {
    setSaving(key)
    setMessage('')
    try {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })

      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: value }))
        setMessage(`บันทึก ${key} สำเร็จ`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (err) {
      console.error('Failed to update setting:', err)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Controls</h1>
        <p className="text-gray-500">จัดการ Feature Toggle สำหรับทดสอบระบบ</p>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
          {message}
        </div>
      )}

      {/* Free Trial Section */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Free Trial Signal</h2>
            <p className="text-sm text-gray-500 mt-1">
              เมื่อเปิด: สมาชิกใหม่ที่สมัครจะได้ใช้ Signal ฟรีโดยอัตโนมัติ
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            settings.free_trial_enabled
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {settings.free_trial_enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
          </span>
        </div>

        <div className="space-y-4">
          {/* Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">เปิด/ปิด Free Trial</p>
              <p className="text-xs text-gray-500">สมาชิกใหม่จะได้ Signal ฟรีทันทีหลังสมัคร</p>
            </div>
            <button
              onClick={() => updateSetting('free_trial_enabled', !settings.free_trial_enabled)}
              disabled={saving === 'free_trial_enabled'}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                settings.free_trial_enabled ? 'bg-emerald-500' : 'bg-gray-300'
              } ${saving === 'free_trial_enabled' ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                settings.free_trial_enabled ? 'translate-x-7' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Days */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">จำนวนวันทดลองใช้</p>
              <p className="text-xs text-gray-500">กี่วันที่สมาชิกใหม่จะได้ใช้ฟรี</p>
            </div>
            <div className="flex items-center gap-2">
              {[7, 14, 30, 60].map(days => (
                <button
                  key={days}
                  onClick={() => updateSetting('free_trial_days', days)}
                  disabled={saving === 'free_trial_days'}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    settings.free_trial_days === days
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {days} วัน
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Affiliate Section */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Affiliate Commission</h2>
            <p className="text-sm text-gray-500 mt-1">
              เมื่อปิด: จะไม่แจก commission ให้ upline เมื่ออนุมัติ order
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            settings.affiliate_enabled
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {settings.affiliate_enabled ? 'เปิดอยู่' : 'ล็อคอยู่'}
          </span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">เปิด/ปิด Affiliate</p>
            <p className="text-xs text-gray-500">
              {settings.affiliate_enabled
                ? 'Commission จะถูกแจกเมื่อ Admin อนุมัติ order'
                : 'Commission จะไม่ถูกแจก (ล็อคไว้ระหว่างทดสอบ)'
              }
            </p>
          </div>
          <button
            onClick={() => updateSetting('affiliate_enabled', !settings.affiliate_enabled)}
            disabled={saving === 'affiliate_enabled'}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              settings.affiliate_enabled ? 'bg-emerald-500' : 'bg-gray-300'
            } ${saving === 'affiliate_enabled' ? 'opacity-50' : ''}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
              settings.affiliate_enabled ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {!settings.affiliate_enabled && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>ล็อคอยู่:</strong> ระบบ Affiliate ถูกปิดชั่วคราว ข้อมูล commission ที่มีอยู่จะไม่ถูกลบ
              เมื่อพร้อมเปิดใช้งานจริง ให้เปิด toggle ด้านบน
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">สถานะปัจจุบัน</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>Free Trial: {settings.free_trial_enabled ? `เปิด (${settings.free_trial_days} วัน)` : 'ปิด'} — สมาชิกใหม่{settings.free_trial_enabled ? 'ได้ Signal ฟรี' : 'ต้องซื้อ Signal'}</p>
          <p>Affiliate: {settings.affiliate_enabled ? 'เปิด — แจก commission ปกติ' : 'ล็อค — ไม่แจก commission'}</p>
        </div>
      </div>
    </div>
  )
}
