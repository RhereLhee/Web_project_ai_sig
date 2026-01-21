// app/api/progress/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserWithSubscription } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { videoId, watchedSeconds, completed, progress } = body

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 })
    }

    // ตรวจสอบว่า video มีอยู่จริง
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    // Upsert progress
    const userProgress = await prisma.userProgress.upsert({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId,
        },
      },
      update: {
        watchedSeconds: watchedSeconds ?? undefined,
        progress: progress ?? undefined,
        completed: completed ?? undefined,
        completedAt: completed ? new Date() : undefined,
        lastWatchedAt: new Date(),
      },
      create: {
        userId: user.id,
        videoId,
        watchedSeconds: watchedSeconds ?? 0,
        progress: progress ?? 0,
        completed: completed ?? false,
        completedAt: completed ? new Date() : null,
      },
    })

    return NextResponse.json({ success: true, progress: userProgress })
  } catch (error) {
    console.error('Update progress error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get('videoId')
    const courseId = searchParams.get('courseId')

    if (videoId) {
      // Get progress for specific video
      const progress = await prisma.userProgress.findUnique({
        where: {
          userId_videoId: {
            userId: user.id,
            videoId,
          },
        },
      })

      return NextResponse.json({ progress })
    }

    if (courseId) {
      // Get progress for all videos in course
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        include: {
          sections: {
            include: { videos: { select: { id: true } } },
          },
        },
      })

      if (!course) {
        return NextResponse.json({ error: 'Course not found' }, { status: 404 })
      }

      const videoIds = course.sections.flatMap(s => s.videos.map(v => v.id))

      const progress = await prisma.userProgress.findMany({
        where: {
          userId: user.id,
          videoId: { in: videoIds },
        },
      })

      const total = videoIds.length
      const completed = progress.filter(p => p.completed).length
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

      return NextResponse.json({
        progress,
        summary: {
          total,
          completed,
          percentage,
        },
      })
    }

    return NextResponse.json({ error: 'videoId or courseId is required' }, { status: 400 })
  } catch (error) {
    console.error('Get progress error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}