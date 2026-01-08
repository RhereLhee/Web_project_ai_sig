import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/jwt"

function generateOrderNumber(): string {
  const date = new Date()
  const prefix = date.getFullYear().toString().slice(-2) + 
    String(date.getMonth() + 1).padStart(2, '0') +
    String(date.getDate()).padStart(2, '0')
  const random = Math.random().toString(36).substr(2, 6).toUpperCase()
  return `TT${prefix}${random}`
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { planSlug } = await request.json()

    const plan = await prisma.plan.findUnique({
      where: { slug: planSlug },
    })

    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // Create subscription first
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: "PENDING",
      },
    })

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNo: generateOrderNumber(),
        userId: user.id,
        subscriptionId: subscription.id,
        amount: plan.price,
        affiliatePool: plan.affiliatePool,
        status: "PENDING",
      },
    })

    return NextResponse.json({ 
      success: true, 
      orderId: order.id,
      orderNumber: order.orderNo,
    })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 })
  }
}