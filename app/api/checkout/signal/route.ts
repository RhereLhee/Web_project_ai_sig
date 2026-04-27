// app/api/checkout/signal/route.ts
//
// Locked pricing model:
//   - Single VIP tier @ VIP_PRICE_SATANG (default 49900 = ฿499) for 1 month
//   - Price is fetched from SystemSetting via getVipPriceSatang() so admin can
//     adjust without redeploy. Server is the source of truth — clients NEVER
//     pass price; they only request "create me a VIP order".
//   - Affiliate pool computed at approve time (30% of finalAmount).
//   - First-payment flag drives commission scope (renewals do not pay commission).
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { generatePayload, generateQRCode, PROMPTPAY_CONFIG } from "@/lib/promptpay"
import { validateCSRF } from "@/lib/csrf"
import { buildOrderPaymentFields, isFirstPaymentForBuyer } from "@/lib/order-helpers"
import { getVipPriceSatang } from "@/lib/system-settings"
import { logger } from "@/lib/logger"
import { PaymentMethod } from "@prisma/client"

/** Months of access granted per VIP order. Single tier, 1 month. */
const VIP_DURATION_MONTHS = 1
const VIP_BONUS_MONTHS = 0

const VALID_PAYMENT_METHODS: PaymentMethod[] = ["QR_CODE", "BANK_APP", "CREDIT_CARD"]
function coercePaymentMethod(input: unknown): PaymentMethod {
  if (typeof input === "string" && (VALID_PAYMENT_METHODS as readonly string[]).includes(input)) {
    return input as PaymentMethod
  }
  return "QR_CODE"
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

    const body = await request.json().catch(() => ({}))
    const paymentMethod = coercePaymentMethod(body?.paymentMethod)

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, referredById: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Server-side price (never trust client).
    const finalAmountSatang = await getVipPriceSatang()
    if (!Number.isInteger(finalAmountSatang) || finalAmountSatang <= 0) {
      return NextResponse.json({ error: "ราคา VIP ไม่ถูกต้อง" }, { status: 500 })
    }

    // Order number — Date.now() + crypto bytes is collision-safe enough for our scale.
    const { randomBytes } = await import("crypto")
    const orderNumber = `SIG-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`

    const { order, expectedAmountBaht } = await prisma.$transaction(async (tx) => {
      const payFields = await buildOrderPaymentFields(tx, finalAmountSatang)
      const firstPayment = await isFirstPaymentForBuyer(tx, user.id)

      const expectedBaht = payFields.expectedAmountSatang / 100
      let qrCodeData: string | null = null
      try {
        const qrPayload = generatePayload(PROMPTPAY_CONFIG.id, { amount: expectedBaht })
        qrCodeData = await generateQRCode(qrPayload)
      } catch (err) {
        logger.error("QR generation error", { context: "payment", error: err })
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          orderType: "SIGNAL",
          originalAmount: finalAmountSatang,
          discountAmount: 0,
          // Affiliate pool is computed dynamically at approve time (30% of finalAmount).
          affiliatePool: 0,
          finalAmount: finalAmountSatang,
          expectedAmountSatang: payFields.expectedAmountSatang,
          amountSuffix: payFields.amountSuffix,
          expiresAt: payFields.expiresAt,
          isFirstPayment: firstPayment,
          status: "PENDING",
          paymentMethod,
          qrCodeData,
          metadata: {
            tier: "VIP",
            months: VIP_DURATION_MONTHS,
            bonus: VIP_BONUS_MONTHS,
            totalMonths: VIP_DURATION_MONTHS + VIP_BONUS_MONTHS,
            hasReferral: !!user.referredById,
          },
        },
      })
      return { order: created, expectedAmountBaht: expectedBaht }
    })

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      // EXACT expected amount (with the 1..99 satang suffix). Client must show this.
      finalAmount: order.expectedAmountSatang,
      finalPrice: expectedAmountBaht,
      amountSuffix: order.amountSuffix,
      expiresAt: order.expiresAt,
      qrCodeData: order.qrCodeData,
      paymentMethod,
      promptPayId: PROMPTPAY_CONFIG.id,
      promptPayName: PROMPTPAY_CONFIG.name,
      plan: {
        tier: "VIP",
        months: VIP_DURATION_MONTHS,
        bonus: VIP_BONUS_MONTHS,
        totalMonths: VIP_DURATION_MONTHS + VIP_BONUS_MONTHS,
        priceSatang: finalAmountSatang,
        priceBaht: finalAmountSatang / 100,
      },
    })
  } catch (error) {
    logger.error("Signal checkout failed", { context: "payment", error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET — public price endpoint (used by misc UI surfaces that need the current VIP price).
export async function GET() {
  const priceSatang = await getVipPriceSatang()
  return NextResponse.json({
    plan: {
      tier: "VIP",
      months: VIP_DURATION_MONTHS,
      bonus: VIP_BONUS_MONTHS,
      totalMonths: VIP_DURATION_MONTHS + VIP_BONUS_MONTHS,
      priceSatang,
      priceBaht: priceSatang / 100,
    },
  })
}
