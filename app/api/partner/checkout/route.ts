// app/api/partner/checkout/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { generatePromptPayQR } from "@/lib/promptpay"
import { validateCSRF } from "@/lib/csrf"
import { buildOrderPaymentFields, isFirstPaymentForBuyer } from "@/lib/order-helpers"

// ============================================
// Partner Plans - ราคา 199 บาท (satang)
// ============================================
const PARTNER_PLANS: Record<number, { price: number; bonus: number }> = {
  1: { price: 19900, bonus: 0 },      // 199 บาท
  3: { price: 49900, bonus: 1 },      // 499 บาท
  6: { price: 89900, bonus: 2 },      // 899 บาท
  12: { price: 149900, bonus: 3 },    // 1,499 บาท
}

// PromptPay ID — ต้องตั้งค่าใน .env เท่านั้น
const PROMPTPAY_ID = process.env.PROMPTPAY_ID
if (!PROMPTPAY_ID) {
  console.error('PROMPTPAY_ID environment variable is required')
}

export async function POST(req: NextRequest) {
  try {
    if (!validateCSRF(req)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 })
    }

    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = payload.userId
    const { months, bankName, accountNumber, accountName } = await req.json()

    if (!PROMPTPAY_ID) {
      return NextResponse.json({ error: "ระบบชำระเงินยังไม่พร้อม กรุณาติดต่อแอดมิน" }, { status: 503 })
    }

    // Validate required fields
    if (!months || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 })
    }

    // Get plan from server (คำนวณราคาเอง ไม่รับจาก client)
    const plan = PARTNER_PLANS[months]
    if (!plan) {
      return NextResponse.json({ error: "แพ็กเกจไม่ถูกต้อง" }, { status: 400 })
    }

    const price = plan.price // satang (base — before suffix)
    const bonus = plan.bonus

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

    // Build order with unique-amount suffix + TTL + first-payment flag (transactional)
    const { order, expectedAmountBaht } = await prisma.$transaction(async (tx) => {
      const payFields = await buildOrderPaymentFields(tx, price)
      const firstPayment = await isFirstPaymentForBuyer(tx, userId)

      // Generate QR with the EXPECTED amount (base + suffix) so payment matches exactly
      const expectedBaht = payFields.expectedAmountSatang / 100
      let qrCodeData = ''
      try {
        qrCodeData = await generatePromptPayQR(PROMPTPAY_ID!, expectedBaht)
      } catch {
        // Fall back to manual transfer instructions
      }

      const created = await tx.order.create({
        data: {
          partnerId: partner.id,
          userId,
          orderType: 'PARTNER',
          originalAmount: price,
          finalAmount: price,
          expectedAmountSatang: payFields.expectedAmountSatang,
          amountSuffix: payFields.amountSuffix,
          expiresAt: payFields.expiresAt,
          isFirstPayment: firstPayment,
          status: 'PENDING',
          qrCodeData: qrCodeData || null,
          metadata: {
            months,
            bonus,
            totalMonths,
            promptPayId: PROMPTPAY_ID,
          },
        },
      })

      return { order: created, expectedAmountBaht: expectedBaht }
    })

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      // IMPORTANT: return the exact amount customer must transfer (including 1-99 satang suffix)
      expectedAmount: expectedAmountBaht,
      amountSuffix: order.amountSuffix,
      expiresAt: order.expiresAt,
      finalPrice: expectedAmountBaht, // backward-compat alias
      qrCodeData: order.qrCodeData,
      promptPayId: PROMPTPAY_ID,
    })

  } catch (error) {
    const { logger } = require('@/lib/logger')
    logger.error('Partner checkout failed', { context: 'payment', error })
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 })
  }
}