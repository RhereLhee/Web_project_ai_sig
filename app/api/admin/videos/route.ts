import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { courseId, title, url, youtubeId, duration } = await request.json()

    if (!courseId || !title || !url) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
    }

    const maxOrder = await prisma.video.aggregate({
      where: { courseId },
      _max: { order: true },
    })

    const video = await prisma.video.create({
      data: {
        courseId,
        title,
        section: 'บทที่ 1', // Default section
        youtubeId: youtubeId || null,
        duration: duration || null,
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json({ success: true, video })
  } catch (error) {
    console.error('Create video error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}