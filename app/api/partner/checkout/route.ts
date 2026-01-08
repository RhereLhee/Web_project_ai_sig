import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = payload.userId  // ✅ ใช้ payload.userId

    const { months, bonus, price, bankName, accountNumber, accountName } = await req.json()

    // Validate
    if (!months || !bankName || !accountNumber || !accountName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Check if already partner
    const existingPartner = await prisma.partner.findUnique({
      where: { userId }
    })

    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + months + (bonus || 0))

    if (existingPartner) {
      // Update existing partner
      const newEndDate = existingPartner.status === 'ACTIVE' && existingPartner.endDate && existingPartner.endDate > new Date()
        ? new Date(existingPartner.endDate.getTime() + (months + (bonus || 0)) * 30 * 24 * 60 * 60 * 1000)
        : endDate

      const partner = await prisma.partner.update({
        where: { userId },
        data: {
          bankName,
          accountNumber,
          accountName,
          status: 'ACTIVE',
          startDate,
          endDate: newEndDate,
          price,
          durationMonths: months,
        }
      })

      // Create order
      await prisma.order.create({
        data: {
          partnerId: partner.id,
          userId,
          orderType: 'PARTNER',
          originalAmount: price,
          finalAmount: price,
          status: 'PAID',
          paidAt: new Date(),
        }
      })

      return NextResponse.json({ success: true, partner })
    } else {
      // Create new partner
      const partner = await prisma.partner.create({
        data: {
          userId,
          bankName,
          accountNumber,
          accountName,
          status: 'ACTIVE',
          startDate,
          endDate,
          price,
          durationMonths: months,
        }
      })

      // Create order
      await prisma.order.create({
        data: {
          partnerId: partner.id,
          userId,
          orderType: 'PARTNER',
          originalAmount: price,
          finalAmount: price,
          status: 'PAID',
          paidAt: new Date(),
        }
      })

      return NextResponse.json({ success: true, partner })
    }
  } catch (error) {
    console.error("Partner checkout error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}