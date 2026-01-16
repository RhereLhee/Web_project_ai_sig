// app/api/admin/2fa/setup/route.ts
import { NextResponse } from "next/server"
import { getUserWithSubscription } from "@/lib/auth"
import { initiate2FASetup } from "@/lib/security"

export async function POST() {
  try {
    const user = await getUserWithSubscription()
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      )
    }

    const result = await initiate2FASetup(user.id)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      qrCodeUri: result.qrCodeUri,
      secret: result.secret
    })
  } catch (error) {
    console.error("2FA setup error:", error)
    return NextResponse.json(
      { error: "Failed to setup 2FA" },
      { status: 500 }
    )
  }
}