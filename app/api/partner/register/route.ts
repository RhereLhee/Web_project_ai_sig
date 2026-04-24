// app/api/partner/register/route.ts
// Free Partner registration — creates/updates the caller's Partner record with bank info.
// No payment, no subscription. status=ACTIVE, endDate=null (permanent).
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { PartnerStatus } from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as {
      bankName?: string
      accountNumber?: string
      accountName?: string
    } | null

    const bankName = (body?.bankName || '').trim()
    const accountNumber = (body?.accountNumber || '').replace(/\D/g, '')
    const accountName = (body?.accountName || '').trim()

    if (!bankName) return NextResponse.json({ error: 'กรุณาเลือกธนาคาร' }, { status: 400 })
    if (accountNumber.length < 10 || accountNumber.length > 15) {
      return NextResponse.json({ error: 'เลขบัญชีไม่ถูกต้อง' }, { status: 400 })
    }
    if (accountName.length < 2) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อบัญชี' }, { status: 400 })
    }

    // Block updating bank info once a phone is locked from a prior withdrawal,
    // unless the bank details are identical — protects against late-stage hijacks.
    const existing = await prisma.partner.findUnique({ where: { userId: payload.userId } })
    if (existing?.withdrawPhoneLockedAt) {
      const same =
        existing.bankName === bankName &&
        existing.accountNumber === accountNumber &&
        existing.accountName === accountName
      if (!same) {
        return NextResponse.json(
          {
            error: 'บัญชีถูกล็อคหลังจากการถอนเงินครั้งแรก หากต้องการเปลี่ยนกรุณาติดต่อแอดมิน',
            code: 'BANK_LOCKED',
          },
          { status: 400 },
        )
      }
    }

    const partner = await prisma.partner.upsert({
      where: { userId: payload.userId },
      update: {
        bankName,
        accountNumber,
        accountName,
        // Promote to ACTIVE in case the record is left over from the old paid flow.
        status: PartnerStatus.ACTIVE,
        startDate: existing?.startDate ?? new Date(),
        endDate: null,
      },
      create: {
        userId: payload.userId,
        bankName,
        accountNumber,
        accountName,
        status: PartnerStatus.ACTIVE,
        startDate: new Date(),
        endDate: null,
        price: 0,
        durationMonths: 0,
      },
    })

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        bankName: partner.bankName,
        accountNumber: partner.accountNumber,
        accountName: partner.accountName,
      },
    })
  } catch (error) {
    logger.error('Partner register error', { context: 'partner', error })
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
