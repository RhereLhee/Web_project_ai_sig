// app/api/admin/videos/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserWithSubscription } from '@/lib/auth'

// Helper: ตรวจสอบ Admin
async function checkAdmin() {
  const user = await getUserWithSubscription()
  if (!user || user.role !== 'ADMIN') {
    return null
  }
  return user
}

// POST - สร้างวิดีโอใหม่
export async function POST(request: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId, title, description, url, videoId, provider, duration } = body

    // Validate
    if (!sectionId) {
      return NextResponse.json({ error: 'กรุณาระบุ Section' }, { status: 400 })
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อวิดีโอ' }, { status: 400 })
    }

    if (!videoId) {
      return NextResponse.json({ error: 'กรุณาระบุ Video ID' }, { status: 400 })
    }

    // ตรวจสอบว่า Section มีอยู่จริง
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    })

    if (!section) {
      return NextResponse.json({ error: 'ไม่พบ Section' }, { status: 404 })
    }

    // หา order สูงสุดใน section
    const maxOrder = await prisma.video.aggregate({
      where: { sectionId },
      _max: { order: true },
    })

    // สร้าง thumbnail URL จาก YouTube
    const thumbnail = videoId 
      ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      : null

    // สร้างวิดีโอ
    const video = await prisma.video.create({
      data: {
        sectionId,
        title: title.trim(),
        description: description?.trim() || null,
        url: url || '',
        videoId: videoId || null,
        provider: provider || 'youtube',
        duration: duration || null,
        thumbnail,
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json({ success: true, video })
  } catch (error) {
    console.error('Create video error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// GET - ดึงวิดีโอทั้งหมด (optional: filter by sectionId)
export async function GET(request: NextRequest) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get('sectionId')

    const where = sectionId ? { sectionId } : {}

    const videos = await prisma.video.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        section: {
          select: {
            id: true,
            title: true,
            course: {
              select: { id: true, title: true },
            },
          },
        },
      },
    })

    return NextResponse.json({ videos })
  } catch (error) {
    console.error('Get videos error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}