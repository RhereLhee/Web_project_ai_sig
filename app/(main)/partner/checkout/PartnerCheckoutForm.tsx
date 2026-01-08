"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface PartnerCheckoutFormProps {
  userId: string
  months: number
  bonus: number
  price: number
}

const BANKS = [
  'กสิกรไทย',
  'ไทยพาณิชย์',
  'กรุงเทพ',
  'กรุงไทย',
  'ทหารไทยธนชาต',
  'ออมสิน',
  'กรุงศรี',
  'PromptPay',
]

export function PartnerCheckoutForm({ userId, months, bonus, price }: PartnerCheckoutFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'terms' | 'info' | 'payment'>('terms')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [formData, setFormData] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
  })

  // Step 1: อ่านเงื่อนไข
  if (step === 'terms') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">เงื่อนไข Partner Reward</h2>
        
        <div className="space-y-5 mb-6 max-h-96 overflow-y-auto text-sm text-gray-600">
          {/* Section 1 */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">คุณสมบัติในการรับ Partner Reward</h3>
            <ul className="space-y-1.5">
              <li>• ผู้ใช้ต้องมี Signal Subscription อยู่ในสถานะใช้งาน (Active)</li>
              <li>• ผู้ใช้ต้องมี Partner Plan อยู่ในสถานะใช้งาน (Active)</li>
              <li>• ทั้งสองสถานะต้องอยู่ในช่วง Active ภายในรอบเดือนที่มีการขอถอนผลตอบแทน</li>
            </ul>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">การคำนวณและการถอนผลตอบแทน</h3>
            <ul className="space-y-1.5">
              <li>• ผลตอบแทนคำนวณจากการใช้งานจริงของผู้ใช้บริการที่ถูกแนะนำ</li>
              <li>• ระบบจะทำการสรุปยอดผลตอบแทนเป็นรายเดือน</li>
              <li>• ยอดถอนขั้นต่ำ ฿100 ต่อครั้ง</li>
              <li>• การดำเนินการถอนใช้ระยะเวลาไม่เกิน 3 วันทำการ</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">เงื่อนไขและข้อจำกัด</h3>
            <ul className="space-y-1.5">
              <li>• ระบบไม่มีการรับประกันหรือการการันตีรายได้ใดๆ</li>
              <li>• ผลตอบแทนขึ้นอยู่กับการใช้งานจริงของผู้ใช้บริการ ไม่ได้ขึ้นอยู่กับจำนวนผู้สมัครเพียงอย่างเดียว</li>
              <li>• Partner Reward เป็นผลตอบแทนจากการแนะนำการใช้งานบริการ ไม่ถือเป็นค่าจ้าง ไม่ใช่การลงทุน และไม่เข้าข่ายการระดมทุน</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">ยอดคงเหลือและสถานะบัญชี</h3>
            <ul className="space-y-1.5">
              <li>• ยอดคงเหลือไม่มีวันหมดอายุ</li>
              <li>• หากผู้ใช้ไม่อยู่ในสถานะ Active ในรอบเดือนใด ระบบจะเก็บยอดผลตอบแทนไว้ และสามารถถอนในรอบถัดไปเมื่อสถานะครบเงื่อนไข</li>
              <li>• ระบบไม่มีการยึดหรือหักยอดคงเหลือในทุกกรณี</li>
            </ul>
          </div>

          {/* Key Statement */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-gray-700">
              ระบบนี้ไม่ได้ให้ผลตอบแทนจากการชักชวนสมัครเพียงอย่างเดียว แต่ให้ผลตอบแทนจากการใช้งานบริการจริงของผู้ใช้ที่ถูกแนะนำ
            </p>
          </div>

          {/* Full Terms Link */}
          <a 
            href="/docs/partner-terms.pdf" 
            target="_blank"
            className="inline-block text-gray-500 hover:text-gray-700 hover:underline"
          >
            อ่านเงื่อนไขฉบับเต็ม →
          </a>
        </div>

        <label className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
          />
          <span className="text-sm text-gray-700">
            ข้าพเจ้าได้อ่านและยอมรับ<a href="/docs/partner-terms.pdf" target="_blank" className="underline">เงื่อนไข Partner Reward</a> ทั้งหมดแล้ว
          </span>
        </label>

        <button
          onClick={() => setStep('info')}
          disabled={!acceptedTerms}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 transition-colors"
        >
          ยอมรับและดำเนินการต่อ
        </button>
      </div>
    )
  }

  // Step 2: กรอกข้อมูลธนาคาร
  if (step === 'info') {
    const handleInfoSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      setStep('payment')
    }

    return (
      <form onSubmit={handleInfoSubmit} className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">ข้อมูลบัญชีรับเงิน</h2>
        <p className="text-sm text-gray-500 mb-4">ใช้สำหรับรับ Partner Reward</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ธนาคาร</label>
            <select
              value={formData.bankName}
              onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              required
            >
              <option value="">เลือกธนาคาร</option>
              {BANKS.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี</label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="xxx-x-xxxxx-x"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี</label>
            <input
              type="text"
              value={formData.accountName}
              onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="ชื่อ-นามสกุล ตามบัญชี"
              required
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            type="button"
            onClick={() => setStep('terms')}
            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            ย้อนกลับ
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            ถัดไป
          </button>
        </div>
      </form>
    )
  }

  // Step 3: ชำระเงิน
  const handlePayment = async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/partner/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          months,
          bonus,
          price: price * 100,
          ...formData,
        }),
      })

      if (res.ok) {
        router.push('/partner')
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
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">สรุปรายการ</h2>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">แพ็กเกจ</span>
            <span className="text-gray-900">{months} เดือน {bonus > 0 && `(+${bonus} ฟรี)`}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">ระยะเวลาใช้งาน</span>
            <span className="text-gray-900">{months + bonus} เดือน</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">บัญชีรับเงิน</span>
            <span className="text-gray-900">{formData.bankName} - {formData.accountNumber}</span>
          </div>
          <div className="flex justify-between py-2 font-semibold">
            <span className="text-gray-900">ยอดชำระ</span>
            <span className="text-gray-900">฿{price.toLocaleString()}</span>
          </div>
        </div>

        <button
          onClick={() => setStep('info')}
          className="text-sm text-gray-500 hover:text-gray-700 mt-2"
        >
          แก้ไขข้อมูล
        </button>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">ชำระเงิน</h2>
        
        <div className="bg-gray-100 rounded-lg p-8 mb-4">
          <div className="w-40 h-40 bg-gray-300 mx-auto rounded-lg flex items-center justify-center">
            <span className="text-gray-500 text-sm">QR Code</span>
          </div>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          สแกน QR Code เพื่อชำระ ฿{price.toLocaleString()}
        </p>

        <button 
          onClick={handlePayment} 
          disabled={loading}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 disabled:bg-gray-400 transition-colors"
        >
          {loading ? 'กำลังดำเนินการ...' : 'ยืนยันการชำระเงิน'}
        </button>
      </div>
    </div>
  )
}