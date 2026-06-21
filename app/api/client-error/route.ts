import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, stack, digest, url, userAgent } = body

    logger.error(String(message || 'Client-side error').substring(0, 500), {
      context: 'client',
      metadata: {
        stack: stack ? String(stack).substring(0, 1000) : undefined,
        digest: digest ? String(digest) : undefined,
        url: url ? String(url).substring(0, 300) : undefined,
        userAgent: userAgent ? String(userAgent).substring(0, 200) : undefined,
      },
    })
  } catch {
    // Never let this endpoint throw
  }

  return NextResponse.json({ ok: true })
}
