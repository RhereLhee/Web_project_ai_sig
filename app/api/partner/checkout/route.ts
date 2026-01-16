// app/api/partner/checkout/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

// ============================================
// Partner Plans - ราคา 199 บาท (satang)
// ============================================
const PARTNER_PLANS: Record<number, { price: number; bonus: number }> = {
  1: { price: 19900, bonus: 0 },      // 199 บาท
  3: { price: 49900, bonus: 1 },      // 499 บาท
  6: { price: 89900, bonus: 2 },      // 899 บาท
  12: { price: 149900, bonus: 3 },    // 1,499 บาท
}

// PromptPay ID (เปลี่ยนเป็นของจริงใน .env)
const PROMPTPAY_ID = process.env.PROMPTPAY_ID || '0812345678'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = payload.userId
    const { months, bankName, accountNumber, accountName } = await req.json()

    // Validate required fields
    if (!months || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 })
    }

    // Get plan from server (คำนวณราคาเอง ไม่รับจาก client)
    const plan = PARTNER_PLANS[months]
    if (!plan) {
      return NextResponse.json({ error: "แพ็กเกจไม่ถูกต้อง" }, { status: 400 })
    }

    const price = plan.price // satang
    const bonus = plan.bonus
    const priceBaht = price / 100

    // Validate bank info
    const cleanAccountNumber = accountNumber.replace(/\D/g, '')
    if (cleanAccountNumber.length < 10 || cleanAccountNumber.length > 15) {
      return NextResponse.json({ error: "เลขบัญชีต้องมี 10-15 หลัก" }, { status: 400 })
    }
    if (accountName.trim().length < 2) {
      return NextResponse.json({ error: "กรุณาระบุชื่อบัญชี" }, { status: 400 })
    }

    // Check existing partner
    const existingPartner = await prisma.partner.findUnique({
      where: { userId }
    })

    const totalMonths = months + bonus
    let partner

    if (existingPartner) {
      // Update existing partner
      partner = await prisma.partner.update({
        where: { userId },
        data: {
          bankName,
          accountNumber: cleanAccountNumber,
          accountName: accountName.trim(),
          price,
          durationMonths: months,
        }
      })
    } else {
      // Create new partner
      partner = await prisma.partner.create({
        data: {
          userId,
          bankName,
          accountNumber: cleanAccountNumber,
          accountName: accountName.trim(),
          status: 'PENDING',
          price,
          durationMonths: months,
        }
      })
    }

    // Generate QR Code
    let qrCodeData = ''
    try {
      // Dynamic import เพื่อไม่ให้ error ถ้ายังไม่มี lib
      const { generatePromptPayQR } = await import('@/lib/promptpay')
      qrCodeData = await generatePromptPayQR(PROMPTPAY_ID, priceBaht)
    } catch (e) {
      console.error('QR generation error:', e)
      // ถ้าสร้าง QR ไม่ได้ ก็ให้โอนเอง
    }

    // Create Order (PENDING)
    const order = await prisma.order.create({
      data: {
        partnerId: partner.id,
        userId,
        orderType: 'PARTNER',
        originalAmount: price,
        finalAmount: price,
        status: 'PENDING',
        qrCodeData: qrCodeData || null,
        metadata: {
          months,
          bonus,
          totalMonths,
          promptPayId: PROMPTPAY_ID,
        }
      }
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      finalPrice: priceBaht,
      qrCodeData,
      promptPayId: PROMPTPAY_ID,
    })

  } catch (error) {
    console.error("Partner checkout error:", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 })
  }
}