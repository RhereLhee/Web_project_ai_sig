import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { videoId, watchedSeconds, completed } = await request.json()

    // Get video duration
    const video = await prisma.video.findUnique({
      where: { id: videoId },
    })

    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 })
    }

    const progress = video.duration
      ? Math.min(100, Math.round((watchedSeconds / video.duration) * 100))
      : completed ? 100 : 0

    // Upsert progress
    const userProgress = await prisma.userProgress.upsert({
      where: {
        userId_videoId: {
          userId: user.id,
          videoId,
        },
      },
      update: {
        watched: watchedSeconds,
        done: completed,
      },
      create: {
        userId: user.id,
        videoId,
        watched: watchedSeconds,
        done: completed,
      },
    })

    return NextResponse.json({ success: true, progress: userProgress })
  } catch (error) {
    console.error("Progress update error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}