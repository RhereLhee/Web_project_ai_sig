// app/api/admin/videos/[videoId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserWithSubscription } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ videoId: string }>
}

// Helper: ตรวจสอบ Admin
async function checkAdmin() {
  const user = await getUserWithSubscription()
  if (!user || user.role !== 'ADMIN') {
    return null
  }
  return user
}

// GET - ดึงข้อมูลวิดีโอ
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = await params

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        section: {
          select: {
            id: true,
            title: true,
            course: {
              select: { id: true, title: true, slug: true },
            },
          },
        },
      },
    })

    if (!video) {
      return NextResponse.json({ error: 'ไม่พบวิดีโอ' }, { status: 404 })
    }

    return NextResponse.json({ video })
  } catch (error) {
    console.error('Get video error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// PUT - อัปเดตวิดีโอ
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = await params
    const body = await request.json()
    const { title, description, url, videoId: newVideoId, duration, order } = body

    // ตรวจสอบว่ามี video นี้อยู่หรือไม่
    const existingVideo = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!existingVideo) {
      return NextResponse.json({ error: 'ไม่พบวิดีโอ' }, { status: 404 })
    }

    // Handle order change
    if (order !== undefined && order !== existingVideo.order) {
      // Swap orders with adjacent video
      const targetVideo = await prisma.video.findFirst({
        where: {
          sectionId: existingVideo.sectionId,
          order: order,
        },
      })

      if (targetVideo) {
        // Swap
        await prisma.video.update({
          where: { id: targetVideo.id },
          data: { order: existingVideo.order },
        })
      }
    }

    // อัปเดต video
    const video = await prisma.video.update({
      where: { id: videoId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(url !== undefined && { url }),
        ...(newVideoId !== undefined && { videoId: newVideoId }),
        ...(duration !== undefined && { duration }),
        ...(order !== undefined && { order }),
        ...(newVideoId && { thumbnail: `https://img.youtube.com/vi/${newVideoId}/mqdefault.jpg` }),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, video })
  } catch (error) {
    console.error('Update video error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// DELETE - ลบวิดีโอ
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { videoId } = await params

    // ตรวจสอบว่ามี video นี้อยู่หรือไม่
    const existingVideo = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!existingVideo) {
      return NextResponse.json({ error: 'ไม่พบวิดีโอ' }, { status: 404 })
    }

    // ลบ UserProgress ที่เกี่ยวข้อง (ถ้ามี)
    await prisma.userProgress.deleteMany({
      where: { videoId },
    })

    // ลบวิดีโอ
    await prisma.video.delete({
      where: { id: videoId },
    })

    // Reorder remaining videos
    const remainingVideos = await prisma.video.findMany({
      where: { sectionId: existingVideo.sectionId },
      orderBy: { order: 'asc' },
    })

    // Update order for all remaining videos
    for (let i = 0; i < remainingVideos.length; i++) {
      await prisma.video.update({
        where: { id: remainingVideos[i].id },
        data: { order: i + 1 },
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: `ลบวิดีโอ "${existingVideo.title}" สำเร็จ`,
    })
  } catch (error) {
    console.error('Delete video error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}