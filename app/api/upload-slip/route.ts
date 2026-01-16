// app/api/upload-slip/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { existsSync } from "fs"

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const slip = formData.get("slip") as File | null
    const orderNumber = formData.get("orderNumber") as string

    if (!slip || !orderNumber) {
      return NextResponse.json(
        { error: "กรุณาอัพโหลดสลิปและระบุหมายเลขออเดอร์" },
        { status: 400 }
      )
    }

    // Find order
    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        userId: payload.userId,
      },
    })

    if (!order) {
      return NextResponse.json(
        { error: "ไม่พบออเดอร์นี้" },
        { status: 404 }
      )
    }

    if (order.status !== "PENDING") {
      return NextResponse.json(
        { error: "ออเดอร์นี้ไม่อยู่ในสถานะรอชำระเงิน" },
        { status: 400 }
      )
    }

    // Validate file
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"]
    if (!allowedTypes.includes(slip.type)) {
      return NextResponse.json(
        { error: "รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)" },
        { status: 400 }
      )
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (slip.size > maxSize) {
      return NextResponse.json(
        { error: "ไฟล์ใหญ่เกินไป (สูงสุด 5MB)" },
        { status: 400 }
      )
    }

    // Create upload directory
    const uploadDir = join(process.cwd(), "public", "uploads", "slips")
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Generate filename
    const ext = slip.name.split(".").pop() || "jpg"
    const filename = `${orderNumber}-${Date.now()}.${ext}`
    const filepath = join(uploadDir, filename)

    // Save file
    const bytes = await slip.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Update order with slip URL
    const slipUrl = `/uploads/slips/${filename}`
    await prisma.order.update({
      where: { id: order.id },
      data: {
        slipUrl,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: "อัพโหลดสลิปสำเร็จ รอตรวจสอบ 1-3 วันทำการ",
      slipUrl,
    })

  } catch (error) {
    console.error("Upload slip error:", error)
    return NextResponse.json(
      { error: "เกิดข้อผิดพลาดในการอัพโหลด" },
      { status: 500 }
    )
  }
}