// app/api/admin/2fa/confirm/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getUserWithSubscription } from "@/lib/auth"
import { confirm2FASetup } from "@/lib/security"

export async function POST(req: NextRequest) {
  try {
    const user = await getUserWithSubscription()
    
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin only" },
        { status: 403 }
      )
    }

    const { token } = await req.json()

    if (!token || token.length !== 6) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัส 6 หลัก" },
        { status: 400 }
      )
    }

    const result = await confirm2FASetup(user.id, token)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("2FA confirm error:", error)
    return NextResponse.json(
      { error: "Failed to confirm 2FA" },
      { status: 500 }
    )
  }
}