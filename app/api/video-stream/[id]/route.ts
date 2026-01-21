// app/api/video-stream/[id]/route.ts
// API สำหรับดึง Video ID แบบปลอดภัย - ต้อง Login + มีสิทธิ์

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserWithSubscription, hasSignalAccess } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 1. ตรวจสอบ Login
    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบ' }, 
        { status: 401 }
      )
    }

    const { id: videoId } = await params

    // 2. ดึงข้อมูลวิดีโอ + คอร์ส
    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        section: {
          include: {
            course: {
              select: {
                id: true,
                access: true,
                isPublished: true,
              },
            },
          },
        },
      },
    })

    if (!video) {
      return NextResponse.json(
        { error: 'ไม่พบวิดีโอ' }, 
        { status: 404 }
      )
    }

    const course = video.section.course

    // 3. ตรวจสอบว่าคอร์สเผยแพร่แล้ว
    if (!course.isPublished && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'คอร์สนี้ยังไม่เปิดให้เข้าชม' }, 
        { status: 403 }
      )
    }

    // 4. ตรวจสอบสิทธิ์การเข้าถึง
    const hasSignal = hasSignalAccess(user)
    const isPartner = user.partner?.status === 'ACTIVE'
    const isAdmin = user.role === 'ADMIN'

    let canAccess = false

    if (isAdmin) {
      canAccess = true
    } else if (course.access === 'FREE') {
      canAccess = true
    } else if (course.access === 'PRO' && hasSignal) {
      canAccess = true
    } else if (course.access === 'PARTNER' && isPartner) {
      canAccess = true
    }

    if (!canAccess) {
      return NextResponse.json(
        { error: 'คุณไม่มีสิทธิ์เข้าถึงวิดีโอนี้' }, 
        { status: 403 }
      )
    }

    // 5. ส่ง Video ID กลับ (เฉพาะคนที่มีสิทธิ์)
    return NextResponse.json({
      success: true,
      data: {
        videoId: video.videoId,
        provider: video.provider,
        title: video.title,
        duration: video.duration,
      },
    })

  } catch (error) {
    console.error('Video stream error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' }, 
      { status: 500 }
    )
  }
}