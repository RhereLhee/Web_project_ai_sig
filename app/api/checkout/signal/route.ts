import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { generatePayload, generateQRCode } from "@/lib/promptpay"

// ============================================
// SIGNAL PLAN CONFIG - ต้องตรงกับ signals/page.tsx และ checkout/page.tsx
// ============================================
const SIGNAL_CONFIG = {
  basePrice: 2500,
  plans: [
    { months: 1, bonus: 0 },
    { months: 3, bonus: 1 },
    { months: 9, bonus: 3 },
    { months: 12, bonus: 5 },
  ]
}

function validateSignalPlan(months: number, price: number) {
  const planConfig = SIGNAL_CONFIG.plans.find(p => p.months === months)
  if (!planConfig) return false
  
  const expectedPrice = SIGNAL_CONFIG.basePrice * months
  return price === expectedPrice
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { planSlug, paymentMethod, months, price, bonus } = body

    // Validate signal plan
    if (!planSlug || !months || !price) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!validateSignalPlan(months, price)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Generate order number
    const orderNumber = `SIG-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // Convert to satang (price * 100)
    const finalAmount = price * 100

    // Generate QR Code
    let qrCodeData = null
    if (paymentMethod === 'QR_CODE') {
      try {
        // PromptPay ID - ใส่เบอร์โทรหรือ ID ของคุณ
        const promptPayId = process.env.PROMPTPAY_ID || "0812345678"
        const qrPayload = generatePayload(promptPayId, { amount: price })
        qrCodeData = await generateQRCode(qrPayload)
      } catch (err) {
        console.error("QR generation error:", err)
      }
    }

    // Create SignalSubscription record (pending)
    const signalSubscription = await prisma.signalSubscription.create({
      data: {
        userId: user.id,
        status: "PENDING",
        price: finalAmount,
      },
    })

    // Store order info (you might want to create a separate SignalOrder table)
    // For now, we'll use a simple approach with the subscription ID

    return NextResponse.json({
      success: true,
      orderNumber,
      subscriptionId: signalSubscription.id,
      finalAmount,
      qrCodeData,
      paymentMethod,
      plan: {
        months,
        bonus,
        price,
      },
    })

  } catch (error) {
    console.error("Signal checkout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}