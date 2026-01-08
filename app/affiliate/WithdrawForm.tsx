"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface WithdrawFormProps {
  balance: number // satang
  userId: string
}

export function WithdrawForm({ balance, userId }: WithdrawFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
  })

  const maxAmount = balance / 100 // convert to baht

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount) * 100, // convert to satang
        }),
      })

      if (res.ok) {
        alert('ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ')
        setOpen(false)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      alert('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary">
        💸 ถอนเงิน
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">ถอนเงิน</h2>
            
            <div className="bg-emerald-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-600">ยอดที่ถอนได้</p>
              <p className="text-2xl font-bold text-emerald-700">฿{maxAmount.toLocaleString()}</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="input"
                  max={maxAmount}
                  min={100}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ธนาคาร</label>
                <select
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">เลือกธนาคาร</option>
                  <option value="กสิกรไทย">กสิกรไทย</option>
                  <option value="ไทยพาณิชย์">ไทยพาณิชย์</option>
                  <option value="กรุงเทพ">กรุงเทพ</option>
                  <option value="กรุงไทย">กรุงไทย</option>
                  <option value="ทหารไทยธนชาต">ทหารไทยธนชาต</option>
                  <option value="ออมสิน">ออมสิน</option>
                  <option value="PromptPay">PromptPay</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">เลขบัญชี</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ชื่อบัญชี</label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                  className="input"
                  required
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <button type="button" onClick={() => setOpen(false)} className="btn btn-outline flex-1">
                  ยกเลิก
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  {loading ? 'กำลังส่ง...' : 'ยืนยันถอนเงิน'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
