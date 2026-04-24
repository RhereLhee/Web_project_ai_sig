// app/api/checkout/signal/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { generatePayload, generateQRCode, PROMPTPAY_CONFIG } from "@/lib/promptpay"
import { validateCSRF } from "@/lib/csrf"
import { buildOrderPaymentFields, isFirstPaymentForBuyer } from "@/lib/order-helpers"

// ============================================
// SIGNAL PLAN CONFIG - ราคาใหม่
// ============================================
const SIGNAL_CONFIG = {
  plans: [
    { months: 1, price: 2500, bonus: 0 },    // 2,500 บาท ใช้ได้ 1 เดือน
    { months: 3, price: 6999, bonus: 1 },    // 6,999 บาท ใช้ได้ 4 เดือน (+1 ฟรี)
    { months: 6, price: 12999, bonus: 2 },   // 12,999 บาท ใช้ได้ 8 เดือน (+2 ฟรี)
    { months: 9, price: 19999, bonus: 3 },   // 19,999 บาท ใช้ได้ 12 เดือน (+3 ฟรี)
  ],
  // ส่วนลดเมื่อมีรหัสแนะนำ (optional)
  referralDiscount: 300,
}

// Export สำหรับใช้ที่อื่น
export { SIGNAL_CONFIG }

function getSignalPlan(months: number) {
  return SIGNAL_CONFIG.plans.find(p => p.months === months)
}

function validateSignalPlan(months: number, price: number, hasReferral: boolean = false) {
  const planConfig = getSignalPlan(months)
  if (!planConfig) return false
  
  let expectedPrice = planConfig.price
  if (hasReferral) {
    expectedPrice -= SIGNAL_CONFIG.referralDiscount
  }
  
  return price === expectedPrice
}

export async function POST(request: NextRequest) {
  try {
    if (!validateCSRF(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
    }

    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { paymentMethod, months } = body

    // Validate
    if (!months) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const planConfig = getSignalPlan(months)
    if (!planConfig) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        referredById: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // คำนวณราคา
    let finalPrice = planConfig.price
    const hasReferral = !!user.referredById
    
    // ถ้ามีคนแนะนำ ลดราคา (optional - ถ้าไม่ต้องการลดราคา comment บรรทัดนี้)
    if (hasReferral) {
      finalPrice -= SIGNAL_CONFIG.referralDiscount
    }

    // Generate order number (crypto secure)
    const { randomBytes } = require('crypto')
    const orderNumber = `SIG-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`

    // Convert to satang
    const finalAmount = finalPrice * 100

    // Build order with unique-amount suffix + first-payment flag in one tx
    const { order, expectedAmountBaht } = await prisma.$transaction(async (tx) => {
      const payFields = await buildOrderPaymentFields(tx, finalAmount)
      const firstPayment = await isFirstPaymentForBuyer(tx, user.id)

      // Generate QR with EXPECTED amount (base + suffix) so bank transfer matches exactly
      const expectedBaht = payFields.expectedAmountSatang / 100
      let qrCodeData: string | null = null
      try {
        const qrPayload = generatePayload(PROMPTPAY_CONFIG.id, { amount: expectedBaht })
        qrCodeData = await generateQRCode(qrPayload)
      } catch (err) {
        console.error("QR generation error:", err)
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          orderType: 'SIGNAL',
          originalAmount: planConfig.price * 100,
          discountAmount: hasReferral ? SIGNAL_CONFIG.referralDiscount * 100 : 0,
          // affiliatePool is now computed dynamically at approve time (30% of finalAmount)
          affiliatePool: 0,
          finalAmount,
          expectedAmountSatang: payFields.expectedAmountSatang,
          amountSuffix: payFields.amountSuffix,
          expiresAt: payFields.expiresAt,
          isFirstPayment: firstPayment,
          status: 'PENDING',
          paymentMethod: paymentMethod || 'QR_CODE',
          qrCodeData,
          metadata: {
            months: planConfig.months,
            bonus: planConfig.bonus,
            totalMonths: planConfig.months + planConfig.bonus,
            hasReferral,
          },
        },
      })
      return { order: created, expectedAmountBaht: expectedBaht }
    })

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      finalAmount: order.expectedAmountSatang, // EXACT amount with suffix
      finalPrice: expectedAmountBaht,
      amountSuffix: order.amountSuffix,
      expiresAt: order.expiresAt,
      qrCodeData: order.qrCodeData,
      paymentMethod: paymentMethod || 'QR_CODE',
      promptPayId: PROMPTPAY_CONFIG.id,
      promptPayName: PROMPTPAY_CONFIG.name,
      plan: {
        months: planConfig.months,
        bonus: planConfig.bonus,
        totalMonths: planConfig.months + planConfig.bonus,
        price: planConfig.price,
      },
    })

  } catch (error) {
    const { logger } = require('@/lib/logger')
    logger.error('Signal checkout failed', { context: 'payment', error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET - ดึงราคาแพ็คเกจทั้งหมด
export async function GET() {
  return NextResponse.json({
    plans: SIGNAL_CONFIG.plans.map(p => ({
      months: p.months,
      price: p.price,
      bonus: p.bonus,
      totalMonths: p.months + p.bonus,
    })),
    referralDiscount: SIGNAL_CONFIG.referralDiscount,
  })
}