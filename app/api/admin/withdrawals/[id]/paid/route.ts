// app/api/admin/withdrawals/[id]/paid/route.ts
// เมื่อโอนแล้ว withdrawnAmount คงไว้ (ถอนจริงแล้ว)
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { sendWithdrawalPaidEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    
    let paymentRef: string | undefined
    try {
      const body = await request.json()
      paymentRef = body.paymentRef
    } catch {
      // ไม่มี body ก็ไม่เป็นไร
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true } },
        commissions: true,
      },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    }

    if (withdrawal.status !== 'APPROVED') {
      return NextResponse.json({ error: 'รายการนี้ยังไม่ได้รับการอนุมัติ' }, { status: 400 })
    }

    const paidAt = new Date()

    // ============================================
    // Transaction: Update withdrawal + commission
    // ============================================
    await prisma.$transaction(async (tx) => {
      // 1. Update withdrawal
      await tx.withdrawal.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt,
          paymentRef: paymentRef || null,
        },
      })

      // 2. Update Commission: mark as paid
      for (const comm of withdrawal.commissions) {
        await tx.commission.update({
          where: { id: comm.id },
          data: {
            paidAt,
            paidVia: 'WITHDRAWAL',
          },
        })
      }
    })

    // ============================================
    // ส่ง Email แจ้ง User
    // ============================================
    if (withdrawal.user?.email) {
      try {
        await sendWithdrawalPaidEmail(withdrawal.user.email, {
          amount: withdrawal.amount / 100,
          bankCode: withdrawal.bankCode,
          accountNumber: withdrawal.accountNumber,
          accountName: withdrawal.accountName,
          date: paidAt,
          paymentRef,
        })
        console.log(`Sent paid email to ${withdrawal.user.email}`)
      } catch (emailError) {
        console.error('Failed to send paid email:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mark paid error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}