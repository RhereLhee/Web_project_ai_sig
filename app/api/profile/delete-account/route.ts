// app/api/profile/delete-account/route.ts
//
// Soft-delete a user account.
//
// Re-parenting rule:
//   If the deleted user (B) had a referrer (A) and direct referrals (C, D, E),
//   those referrals are re-parented to A so the affiliate chain stays intact.
//   If B had no referrer, C/D/E's referredById becomes null (they become roots).
//
// Soft-delete steps:
//   1. Verify password confirmation
//   2. Atomically: re-parent children + anonymise PII + set deletedAt + bump tokenVersion
//
// Financial records (orders, commissions, withdrawals) are intentionally kept.

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { password, confirmEmail } = await req.json()

    if (!password || !confirmEmail) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสผ่านและอีเมลยืนยัน' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        referredById: true,
        deletedAt: true,
      },
    })
    if (!user || user.deletedAt) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (user.role === 'ADMIN') {
      return NextResponse.json({ error: 'Admin ไม่สามารถลบบัญชีตัวเองได้ ติดต่อ Super Admin' }, { status: 403 })
    }

    // Email confirmation
    if ((confirmEmail as string).toLowerCase().trim() !== (user.email || '').toLowerCase()) {
      return NextResponse.json({ error: 'อีเมลยืนยันไม่ตรงกัน' }, { status: 400 })
    }

    // Password confirmation
    if (!user.password) {
      return NextResponse.json({ error: 'บัญชีนี้ไม่มีรหัสผ่าน ติดต่อ Admin' }, { status: 400 })
    }
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 400 })
    }

    const now = new Date()
    const anonymisedEmail = `deleted_${user.id}@deleted.invalid`

    await prisma.$transaction(async (tx) => {
      // 1. Re-parent direct referrals → move them up to this user's referrer (or null).
      await tx.user.updateMany({
        where: { referredById: user.id },
        data: { referredById: user.referredById ?? null },
      })

      // 2. Anonymise PII + soft-delete.
      await tx.user.update({
        where: { id: user.id },
        data: {
          name: null,
          email: anonymisedEmail,
          phone: null,
          image: null,
          password: null,
          refreshToken: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          // tokenVersion++ → all existing JWTs for this user become invalid instantly.
          tokenVersion: { increment: 1 },
          deletedAt: now,
        },
      })

      // 3. Remove active sessions so the deleted account can't be used.
      await tx.session.deleteMany({ where: { userId: user.id } })
    })

    logger.info('Account deleted (soft)', {
      context: 'auth',
      userId: user.id,
      metadata: { reparentedTo: user.referredById ?? 'null (root)' },
    })

    return NextResponse.json({ success: true, message: 'ลบบัญชีเรียบร้อยแล้ว' })
  } catch (error) {
    logger.error('delete-account error', { context: 'auth', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
