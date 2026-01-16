// app/api/admin/courses/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙]+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Date.now().toString(36)
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const { title, description, type, access, isPublished } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อคอร์ส' }, { status: 400 })
    }

    const maxOrder = await prisma.course.aggregate({ _max: { order: true } })

    const course = await prisma.course.create({
      data: {
        title,
        slug: generateSlug(title),
        description,
        type: type || 'TRADING',
        access: access || 'FREE',
        isPublished: isPublished ?? true,
        order: (maxOrder._max.order || 0) + 1,
      },
    })

    return NextResponse.json({ success: true, course })
  } catch (error) {
    console.error('Create course error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
