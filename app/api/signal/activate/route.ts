import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { months, bonus } = body

    if (!months) {
      return NextResponse.json({ error: "Missing months" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // คำนวณวันหมดอายุ
    const totalMonths = months + (bonus || 0)
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + totalMonths)

    // สร้างหรืออัพเดท SignalSubscription
    const existingSubscription = await prisma.signalSubscription.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      // ต่ออายุ - เพิ่มเดือนจาก endDate เดิม
      const currentEndDate = existingSubscription.endDate || new Date()
      const newEndDate = new Date(currentEndDate)
      newEndDate.setMonth(newEndDate.getMonth() + totalMonths)

      await prisma.signalSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          endDate: newEndDate,
          updatedAt: new Date(),
        },
      })
    } else {
      // สร้างใหม่
      await prisma.signalSubscription.create({
        data: {
          userId: user.id,
          status: "ACTIVE",
          startDate,
          endDate,
          price: 0, // ข้าม payment ไปก่อน
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Signal subscription activated",
      endDate,
    })

  } catch (error) {
    console.error("Signal activate error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}