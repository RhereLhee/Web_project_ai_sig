// app/api/checkout/signal/route.ts
//
// Plans:
//   1m  → 1 month,  0 bonus  (1  total)  @ basePriceSatang × 1.0
//   3m  → 3 months, 1 bonus  (4  total)  @ basePriceSatang × 2.5
//   6m  → 6 months, 2 bonus  (8  total)  @ basePriceSatang × 4.5
//
// Referral discount: ฿100 off any plan (first order only check stays for commission scope).
// Server is the source of truth — clients pass only plan id & paymentMethod.
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { generatePayload, generateQRCode, PROMPTPAY_CONFIG } from "@/lib/promptpay"
import { validateCSRF } from "@/lib/csrf"
import { buildOrderPaymentFields, isFirstPaymentForBuyer } from "@/lib/order-helpers"
import { getVipPriceSatang } from "@/lib/system-settings"
import { logger } from "@/lib/logger"
import { PaymentMethod } from "@prisma/client"

// ──────────────────────────────────────────────
// Plan catalogue (price is relative to 1-month base)
// ──────────────────────────────────────────────
const PLAN_CONFIGS = {
  '1m': { months: 1, bonus: 0, factor: 1.0,   label: '1 เดือน' },
  '3m': { months: 3, bonus: 1, factor: 2.5,   label: '3 เดือน + แถม 1 เดือน' },
  '6m': { months: 6, bonus: 2, factor: 4.5,   label: '6 เดือน + แถม 2 เดือน' },
} as const

type PlanId = keyof typeof PLAN_CONFIGS

function isValidPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && v in PLAN_CONFIGS
}

/** Compute plan price in satang (floor to whole baht). */
function planPriceSatang(baseSatang: number, planId: PlanId): number {
  return Math.floor(baseSatang * PLAN_CONFIGS[planId].factor / 100) * 100
}

/** ฿100 referral discount — applied to any plan. */
const REFERRAL_DISCOUNT_SATANG = 10000

const VALID_PAYMENT_METHODS: PaymentMethod[] = ["QR_CODE", "BANK_APP", "CREDIT_CARD"]
function coercePaymentMethod(input: unknown): PaymentMethod {
  if (typeof input === "string" && (VALID_PAYMENT_METHODS as readonly string[]).includes(input)) {
    return input as PaymentMethod
  }
  return "QR_CODE"
}

// ──────────────────────────────────────────────
// POST — create order
// ──────────────────────────────────────────────
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
    const planId: PlanId = isValidPlanId(body?.plan) ? body.plan : '1m'
    const plan = PLAN_CONFIGS[planId]

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, referredById: true },
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Server-side base price (never trust client).
    const basePriceSatang = await getVipPriceSatang()
    if (!Number.isInteger(basePriceSatang) || basePriceSatang <= 0) {
      return NextResponse.json({ error: "ราคา VIP ไม่ถูกต้อง" }, { status: 500 })
    }

    // Plan price before discount.
    const originalPlanSatang = planPriceSatang(basePriceSatang, planId)

    // ฿100 referral discount for users who signed up via a referral link.
    const hasReferral = !!user.referredById
    const discountSatang = hasReferral ? REFERRAL_DISCOUNT_SATANG : 0
    const finalAmountSatang = Math.max(originalPlanSatang - discountSatang, 100) // floor at ฿1

    const { randomBytes } = await import("crypto")
    const orderNumber = `SIG-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`

    const totalMonths = plan.months + plan.bonus

    const { order, expectedAmountBaht } = await prisma.$transaction(async (tx) => {
      const payFields = await buildOrderPaymentFields(tx, finalAmountSatang)
      const firstPayment = await isFirstPaymentForBuyer(tx, user.id)
      const expectedBaht = payFields.expectedAmountSatang / 100

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: user.id,
          orderType: "SIGNAL",
          originalAmount: originalPlanSatang,
          discountAmount: discountSatang,
          affiliatePool: 0,
          finalAmount: finalAmountSatang,
          expectedAmountSatang: payFields.expectedAmountSatang,
          amountSuffix: payFields.amountSuffix,
          expiresAt: payFields.expiresAt,
          isFirstPayment: firstPayment,
          status: "PENDING",
          paymentMethod,
          qrCodeData: null,
          metadata: {
            tier: "VIP",
            plan: planId,
            months: plan.months,
            bonus: plan.bonus,
            totalMonths,
            hasReferral,
          },
        },
      })
      return { order: created, expectedAmountBaht: expectedBaht }
    }, { timeout: 15_000, maxWait: 10_000 })

    let qrCodeData: string | null = null
    try {
      const qrPayload = generatePayload(PROMPTPAY_CONFIG.id, { amount: expectedAmountBaht })
      qrCodeData = await generateQRCode(qrPayload)
      if (qrCodeData) {
        await prisma.order.update({ where: { id: order.id }, data: { qrCodeData } })
      }
    } catch (err) {
      logger.error("QR generation error", { context: "payment", error: err })
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.orderNumber,
      orderId: order.id,
      finalAmount: order.expectedAmountSatang,
      finalPrice: expectedAmountBaht,
      amountSuffix: order.amountSuffix,
      expiresAt: order.expiresAt,
      qrCodeData,
      paymentMethod,
      promptPayId: PROMPTPAY_CONFIG.id,
      promptPayName: PROMPTPAY_CONFIG.name,
      discount: discountSatang > 0 ? { satang: discountSatang, baht: discountSatang / 100 } : null,
      plan: {
        id: planId,
        label: plan.label,
        tier: "VIP",
        months: plan.months,
        bonus: plan.bonus,
        totalMonths,
        originalPriceSatang: originalPlanSatang,
        priceSatang: finalAmountSatang,
        priceBaht: finalAmountSatang / 100,
      },
    })
  } catch (error) {
    logger.error("Signal checkout failed", { context: "payment", error })
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ──────────────────────────────────────────────
// GET — public price endpoint
// ──────────────────────────────────────────────
export async function GET() {
  const baseSatang = await getVipPriceSatang()
  const plans = Object.entries(PLAN_CONFIGS).map(([id, cfg]) => {
    const price = planPriceSatang(baseSatang, id as PlanId)
    return {
      id,
      label: cfg.label,
      months: cfg.months,
      bonus: cfg.bonus,
      totalMonths: cfg.months + cfg.bonus,
      priceSatang: price,
      priceBaht: price / 100,
      perMonthBaht: Math.round(price / (cfg.months + cfg.bonus) / 100),
      referralDiscountSatang: REFERRAL_DISCOUNT_SATANG,
      referralDiscountBaht: REFERRAL_DISCOUNT_SATANG / 100,
    }
  })
  return NextResponse.json({ plans })
}
