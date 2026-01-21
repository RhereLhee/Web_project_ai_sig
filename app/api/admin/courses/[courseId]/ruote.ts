// app/api/admin/courses/[courseId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserWithSubscription } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ courseId: string }>
}

// Helper: ตรวจสอบ Admin
async function checkAdmin() {
  const user = await getUserWithSubscription()
  if (!user || user.role !== 'ADMIN') {
    return null
  }
  return user
}

// GET - ดึงข้อมูล Course
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: { videos: true },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'ไม่พบคอร์ส' }, { status: 404 })
    }

    return NextResponse.json({ course })
  } catch (error) {
    console.error('Get course error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// PUT - อัปเดต Course
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params
    const body = await request.json()
    const { title, description, type, access, isPublished, order } = body

    // ตรวจสอบว่ามี course นี้อยู่หรือไม่
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!existingCourse) {
      return NextResponse.json({ error: 'ไม่พบคอร์ส' }, { status: 404 })
    }

    // อัปเดต course
    const course = await prisma.course.update({
      where: { id: courseId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(access !== undefined && { access }),
        ...(isPublished !== undefined && { isPublished }),
        ...(order !== undefined && { order }),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, course })
  } catch (error) {
    console.error('Update course error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

// DELETE - ลบ Course (พร้อม Sections และ Videos)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { courseId } = await params

    // ตรวจสอบว่ามี course นี้อยู่หรือไม่
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: { videos: true },
        },
      },
    })

    if (!existingCourse) {
      return NextResponse.json({ error: 'ไม่พบคอร์ส' }, { status: 404 })
    }

    // ลบแบบ cascade (Videos -> Sections -> Course)
    // Prisma schema มี onDelete: Cascade อยู่แล้ว
    await prisma.course.delete({
      where: { id: courseId },
    })

    return NextResponse.json({ 
      success: true, 
      message: `ลบคอร์ส "${existingCourse.title}" สำเร็จ`,
      deleted: {
        course: 1,
        sections: existingCourse.sections.length,
        videos: existingCourse.sections.reduce((sum, s) => sum + s.videos.length, 0),
      }
    })
  } catch (error) {
    console.error('Delete course error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}