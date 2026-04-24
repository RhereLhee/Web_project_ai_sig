// app/api/upload-slip/route.ts
// User uploads a transfer slip for a PENDING order.
// Pipeline:
//   1. Validate file & order
//   2. SHA-256 hash — reject duplicates (same slip submitted twice = reuse attempt)
//   3. Save file to /public/uploads/slips/
//   4. Call SlipOK (lib/slipok.ts) — VERIFIED | REJECTED | MANUAL
//   5. Create SlipVerification row
//   6. On VERIFIED + amount match: create BankTransaction (1:1 with order)
//      The order is NOT auto-approved here — admin still needs to click approve.
//      This separates "we received the money" from "activate the subscription".
//   7. Return slipUrl + verification status to the client

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { verifySlip, sha256, type SlipVerifyStatus } from '@/lib/slipok'
import { logger } from '@/lib/logger'
import { Prisma, SlipVerificationStatus } from '@prisma/client'

/** Map the SlipOK library status into the DB enum.
 *  MANUAL = "SlipOK disabled/unreachable" → PENDING (admin still has to act). */
function toDbStatus(s: SlipVerifyStatus): SlipVerificationStatus {
  switch (s) {
    case 'VERIFIED':
      return SlipVerificationStatus.VERIFIED
    case 'REJECTED':
      return SlipVerificationStatus.REJECTED
    case 'MANUAL':
    case 'PENDING':
    default:
      return SlipVerificationStatus.PENDING
  }
}

const ALLOWED_MIMES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const slip = formData.get('slip') as File | null
    const orderNumber = formData.get('orderNumber') as string | null

    if (!slip || !orderNumber) {
      return NextResponse.json(
        { error: 'กรุณาอัพโหลดสลิปและระบุหมายเลขออเดอร์' },
        { status: 400 },
      )
    }

    if (!ALLOWED_MIMES[slip.type]) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, HEIC)' },
        { status: 400 },
      )
    }
    if (slip.size > MAX_SIZE) {
      return NextResponse.json({ error: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)' }, { status: 400 })
    }

    const order = await prisma.order.findFirst({
      where: { orderNumber, userId: payload.userId },
    })
    if (!order) {
      return NextResponse.json({ error: 'ไม่พบออเดอร์นี้' }, { status: 404 })
    }
    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'ออเดอร์นี้ไม่อยู่ในสถานะรอชำระเงิน' },
        { status: 400 },
      )
    }
    if (order.expiresAt && order.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'ออเดอร์นี้หมดอายุแล้ว กรุณาสร้างออเดอร์ใหม่' },
        { status: 400 },
      )
    }

    // Read file + hash BEFORE saving. Reject duplicates immediately.
    const bytes = await slip.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileHash = sha256(buffer)

    const duplicate = await prisma.slipVerification.findUnique({
      where: { fileSha256: fileHash },
      select: { id: true, orderId: true, status: true },
    })
    if (duplicate) {
      return NextResponse.json(
        {
          error: 'สลิปนี้เคยถูกใช้งานแล้ว ห้ามใช้ซ้ำ',
          code: 'SLIP_REUSED',
          existingOrderId: duplicate.orderId,
        },
        { status: 400 },
      )
    }

    // Compute expected amount (finalAmount + amountSuffix, backward-compat if 0).
    const expectedAmountSatang =
      order.expectedAmountSatang > 0 ? order.expectedAmountSatang : order.finalAmount

    // Save the file. We keep this even on REJECTED so admin can eyeball it.
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'slips')
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

    const ext = ALLOWED_MIMES[slip.type]
    const safeOrderNum = orderNumber.replace(/[^a-zA-Z0-9\-]/g, '')
    const filename = `${safeOrderNum}-${Date.now()}.${ext}`
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)
    const slipUrl = `/uploads/slips/${filename}`

    // Call SlipOK. Never throws — always resolves to a SlipVerifyResult.
    const verification = await verifySlip({
      fileBuffer: buffer,
      fileMime: slip.type,
      expectedAmountSatang,
    })

    // Persist SlipVerification + update order slipUrl + (optionally) create BankTransaction
    // all in one transaction so the admin UI can never see a partial state.
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.slipVerification.create({
            data: {
              orderId: order.id,
              userId: payload.userId,
              fileUrl: slipUrl,
              fileSha256: fileHash,
              provider: verification.provider,
              providerRef: verification.parsed.providerRef ?? null,
              rawResponse: (verification.rawResponse ?? null) as Prisma.InputJsonValue,
              amountSatang: verification.parsed.amountSatang ?? null,
              senderBank: verification.parsed.senderBank ?? null,
              senderName: verification.parsed.senderName ?? null,
              senderAccount: verification.parsed.senderAccount ?? null,
              receiverBank: verification.parsed.receiverBank ?? null,
              receiverName: verification.parsed.receiverName ?? null,
              receiverAccount: verification.parsed.receiverAccount ?? null,
              transferAt: verification.parsed.transferAt ?? null,
              status: toDbStatus(verification.status),
              errorMessage: verification.errorMessage ?? null,
            },
          })

          await tx.order.update({
            where: { id: order.id },
            data: { slipUrl },
          })

          // On VERIFIED + providerRef present → log a BankTransaction.
          // BankTransaction.bankRef is UNIQUE so retries of the same slip can't double-credit.
          if (
            verification.status === 'VERIFIED' &&
            verification.parsed.providerRef &&
            verification.parsed.amountSatang != null
          ) {
            try {
              await tx.bankTransaction.create({
                data: {
                  orderId: order.id,
                  bankRef: verification.parsed.providerRef,
                  amountSatang: verification.parsed.amountSatang,
                  receivedAt: verification.parsed.transferAt ?? new Date(),
                  senderBank: verification.parsed.senderBank ?? null,
                  senderAccount: verification.parsed.senderAccount ?? null,
                  receiverBank: verification.parsed.receiverBank ?? null,
                  receiverAccount: verification.parsed.receiverAccount ?? null,
                  rawData: (verification.rawResponse ?? null) as Prisma.InputJsonValue,
                  source: 'slipok',
                },
              })
            } catch (e) {
              // P2002 = providerRef/orderId already recorded → slip reuse across orders.
              // This should be extremely rare because fileSha256 is checked earlier; if it
              // happens, log and continue. The SlipVerification row still captures the event.
              if (
                e instanceof Prisma.PrismaClientKnownRequestError &&
                e.code === 'P2002'
              ) {
                logger.warn('BankTransaction duplicate (bankRef or orderId reused)', {
                  context: 'payment',
                  metadata: {
                    orderId: order.id,
                    bankRef: verification.parsed.providerRef,
                  },
                })
              } else {
                throw e
              }
            }
          }
        },
        { timeout: 15_000 },
      )
    } catch (e) {
      // If the transaction fails (e.g. SlipVerification unique violation on fileSha256 after
      // a race), fall back to best-effort: still expose the slipUrl so admin sees it.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        logger.warn('Slip upload race — fileSha256 already recorded', {
          context: 'payment',
          metadata: { orderId: order.id, fileHash },
        })
        return NextResponse.json(
          { error: 'สลิปนี้เคยถูกอัพโหลดไปแล้ว', code: 'SLIP_REUSED' },
          { status: 400 },
        )
      }
      throw e
    }

    logger.info('Slip uploaded', {
      context: 'payment',
      userId: payload.userId,
      metadata: {
        orderId: order.id,
        orderNumber,
        status: verification.status,
        provider: verification.provider,
        amountSatang: verification.parsed.amountSatang,
        expectedAmountSatang,
      },
    })

    const message =
      verification.status === 'VERIFIED'
        ? 'สลิปถูกยืนยันโดย SlipOK แล้ว รอ Admin อนุมัติเปิดใช้งาน'
        : verification.status === 'REJECTED'
          ? `สลิปไม่ผ่านการตรวจสอบ: ${verification.errorMessage || 'ไม่ทราบสาเหตุ'} — Admin จะตรวจสอบให้อีกครั้ง`
          : 'อัพโหลดสลิปสำเร็จ รอ Admin ตรวจสอบ 1-3 วันทำการ'

    return NextResponse.json({
      success: true,
      message,
      slipUrl,
      verification: {
        status: verification.status,
        provider: verification.provider,
        amountMatched: verification.parsed.amountSatang === expectedAmountSatang,
      },
    })
  } catch (error) {
    logger.error('Upload slip failed', { context: 'payment', error })
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัพโหลด' },
      { status: 500 },
    )
  }
}
