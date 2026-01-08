"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface WithdrawButtonProps {
  balance: number // satang
  bankInfo: {
    bankName: string
    accountNumber: string
    accountName: string
  }
}

export function WithdrawButton({ balance, bankInfo }: WithdrawButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')

  const maxAmount = balance / 100 // convert to baht
  const canWithdraw = maxAmount >= 100

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWithdraw) return
    
    setLoading(true)

    try {
      const res = await fetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount) * 100, // convert to satang
          bankName: bankInfo.bankName,
          accountNumber: bankInfo.accountNumber,
          accountName: bankInfo.accountName,
        }),
      })

      if (res.ok) {
        alert('ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ')
        setOpen(false)
        setAmount('')
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

  if (!canWithdraw) {
    return (
      <button disabled className="btn btn-outline w-full opacity-50 cursor-not-allowed">
        ถอนขั้นต่ำ ฿100
      </button>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary w-full">
        💸 ถอนเงิน
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">ถอนเงิน</h2>
            
            {/* Balance */}
            <div className="bg-emerald-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-emerald-600">ยอดที่ถอนได้</p>
              <p className="text-2xl font-bold text-emerald-700">฿{maxAmount.toLocaleString()}</p>
            </div>

            {/* Bank Info */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <p className="text-gray-500 mb-1">โอนเข้าบัญชี:</p>
              <p className="font-medium">{bankInfo.bankName}</p>
              <p className="font-mono">{bankInfo.accountNumber}</p>
              <p>{bankInfo.accountName}</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">จำนวนเงิน (บาท)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input"
                  max={maxAmount}
                  min={100}
                  placeholder="ขั้นต่ำ 100 บาท"
                  required
                />
              </div>

              {/* Quick amounts */}
              <div className="flex space-x-2">
                {[100, 500, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmount(Math.min(val, maxAmount).toString())}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                    disabled={val > maxAmount}
                  >
                    ฿{val}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmount(maxAmount.toString())}
                  className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-sm font-medium transition-colors"
                >
                  ทั้งหมด
                </button>
              </div>

              <div className="flex space-x-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => setOpen(false)} 
                  className="btn btn-outline flex-1"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !amount || parseFloat(amount) < 100} 
                  className="btn btn-primary flex-1"
                >
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