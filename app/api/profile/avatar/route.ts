import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const ALLOWED_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์รูปภาพ' }, { status: 400 })
    if (!ALLOWED_MIMES[file.type]) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะ JPG, PNG, WEBP, HEIC' },
        { status: 400 },
      )
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = join(process.cwd(), 'public', 'uploads', 'avatars')
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

    const ext = ALLOWED_MIMES[file.type]
    const filename = `${payload.userId}-${Date.now()}.${ext}`
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    const imageUrl = `/uploads/avatars/${filename}`
    await prisma.user.update({
      where: { id: payload.userId },
      data: { image: imageUrl },
    })

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการอัพโหลด' }, { status: 500 })
  }
}
