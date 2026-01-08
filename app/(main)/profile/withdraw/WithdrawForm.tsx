"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface WithdrawFormProps {
  userId: string
  availableBalance: number
  minWithdraw: number
}

export function WithdrawForm({ userId, availableBalance, minWithdraw }: WithdrawFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    amount: "",
    bankName: "",
    accountNumber: "",
    accountName: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const amount = parseFloat(formData.amount)

    // Validation
    if (amount < minWithdraw) {
      setError(`ขั้นต่ำในการถอนคือ ฿${minWithdraw}`)
      setLoading(false)
      return
    }

    if (amount > availableBalance) {
      setError(`ยอดเงินไม่เพียงพอ (คงเหลือ ฿${availableBalance})`)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: Math.round(amount * 100), // แปลงเป็น satang
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      // Success
      router.refresh()
      setFormData({ amount: "", bankName: "", accountNumber: "", accountName: "" })
      alert('ส่งคำขอถอนเงินเรียบร้อยแล้ว')
    } catch (err) {
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          จำนวนเงิน (฿)
        </label>
        <input
          type="number"
          step="0.01"
          min={minWithdraw}
          max={availableBalance}
          value={formData.amount}
          onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
          className="input"
          placeholder={`ขั้นต่ำ ${minWithdraw} บาท`}
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          คงเหลือ: ฿{availableBalance.toLocaleString()}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ธนาคาร
        </label>
        <select
          value={formData.bankName}
          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
          className="input"
          required
        >
          <option value="">เลือกธนาคาร</option>
          <option value="กสิกรไทย">กสิกรไทย</option>
          <option value="กรุงเทพ">กรุงเทพ</option>
          <option value="กรุงไทย">กรุงไทย</option>
          <option value="ไทยพาณิชย์">ไทยพาณิชย์</option>
          <option value="กรุงศรีอยุธยา">กรุงศรีอยุธยา</option>
          <option value="ทหารไทยธนชาต">ทหารไทยธนชาต</option>
          <option value="ออมสิน">ออมสิน</option>
          <option value="อาคารสงเคราะห์">อาคารสงเคราะห์</option>
          <option value="ธ.ก.ส.">ธ.ก.ส.</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          เลขที่บัญชี
        </label>
        <input
          type="text"
          value={formData.accountNumber}
          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, '') })}
          className="input"
          placeholder="1234567890"
          maxLength={15}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ชื่อบัญชี
        </label>
        <input
          type="text"
          value={formData.accountName}
          onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
          className="input"
          placeholder="นาย/นาง/นางสาว ..."
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full"
      >
        {loading ? 'กำลังดำเนินการ...' : 'ขอถอนเงิน'}
      </button>
    </form>
  )
}