// app/api/admin/2fa/status/route.ts
import { NextResponse } from "next/server"
import { getUserWithSubscription } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const user = await getUserWithSubscription()
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      )
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true }
    })

    return NextResponse.json({
      enabled: userData?.twoFactorEnabled || false
    })
  } catch (error) {
    console.error("2FA status error:", error)
    return NextResponse.json(
      { error: "Failed to get status" },
      { status: 500 }
    )
  }
}