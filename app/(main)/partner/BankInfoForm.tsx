"use client"

// Partner bank-info registration form.
// No payment — creates/updates a Partner record with ACTIVE status and the given bank details.
import { useState } from "react"
import { useRouter } from "next/navigation"

const BANKS = [
  { code: 'KBANK', name: 'กสิกรไทย' },
  { code: 'SCB', name: 'ไทยพาณิชย์' },
  { code: 'BBL', name: 'กรุงเทพ' },
  { code: 'KTB', name: 'กรุงไทย' },
  { code: 'TMB', name: 'ทหารไทยธนชาต' },
  { code: 'GSB', name: 'ออมสิน' },
  { code: 'BAY', name: 'กรุงศรี' },
]

export function BankInfoForm({
  initialBankName = '',
  initialAccountNumber = '',
  initialAccountName = '',
}: {
  initialBankName?: string
  initialAccountNumber?: string
  initialAccountName?: string
}) {
  const router = useRouter()
  const [bankName, setBankName] = useState(initialBankName)
  const [accountNumber, setAccountNumber] = useState(initialAccountNumber)
  const [accountName, setAccountName] = useState(initialAccountName)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!bankName) return setError('กรุณาเลือกธนาคาร')
    if (!accountNumber || accountNumber.length < 10) return setError('เลขบัญชีต้องมีอย่างน้อย 10 หลัก')
    if (!accountName || accountName.trim().length < 2) return setError('กรุณาระบุชื่อบัญชี')

    setLoading(true)
    try {
      const res = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName, accountNumber, accountName: accountName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'ลงทะเบียนไม่สำเร็จ')
        setLoading(false)
        return
      }
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ธนาคาร</label>
        <select
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="">เลือกธนาคาร</option>
          {BANKS.map((b) => (
            <option key={b.code} value={b.name}>{b.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี</label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
          placeholder="1234567890"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
          maxLength={15}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี</label>
        <input
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="นาย สมชาย ใจดี"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        {loading ? 'กำลังบันทึก...' : 'บันทึกบัญชีธนาคาร'}
      </button>
    </form>
  )
}
