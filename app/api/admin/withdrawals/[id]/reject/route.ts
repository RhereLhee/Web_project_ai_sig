// app/api/admin/withdrawals/[id]/reject/route.ts
// คืนเงิน = ลด withdrawnAmount กลับ
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { sendWithdrawalRejectedEmail } from '@/lib/email'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const { reason } = await request.json()

    if (!reason || reason.trim() === '') {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลในการปฏิเสธ' }, { status: 400 })
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, name: true } },
        commissions: true, // ดึง commissions ที่ link กับ withdrawal นี้
      },
    })

    if (!withdrawal) {
      return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ error: 'รายการนี้ไม่อยู่ในสถานะรอดำเนินการ' }, { status: 400 })
    }

    // ============================================
    // Transaction: Update withdrawal + คืนเงิน
    // ============================================
    await prisma.$transaction(async (tx) => {
      // 1. Update withdrawal status
      await tx.withdrawal.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedBy: admin?.id || null,
          rejectedAt: new Date(),
          rejectedReason: reason,
        },
      })

      // 2. คืนเงิน: ลด withdrawnAmount กลับ
      for (const comm of withdrawal.commissions) {
        // คำนวณยอดที่ต้องคืน (ยอดที่ถอนจาก commission นี้)
        // เราต้องหาว่า commission นี้ถูกถอนไปเท่าไหร่ในการถอนครั้งนี้
        // วิธีง่ายสุด: ดูว่า withdrawalId ตรงกับ withdrawal นี้
        
        const availableBeforeWithdraw = comm.amount - comm.withdrawnAmount
        
        // ถ้า commission นี้ถอนหมดแล้ว (FULLY_WITHDRAWN) ให้คืนทั้งหมด
        // ถ้าถอนบางส่วน ให้คืนส่วนที่ถอน
        
        // Reset withdrawnAmount เฉพาะส่วนที่ link กับ withdrawal นี้
        // เนื่องจาก 1 commission อาจถูกถอนหลายครั้ง เราต้อง track ดีๆ
        // แต่ตอนนี้ใช้ withdrawalId เป็น "การถอนล่าสุด" 
        // ดังนั้นเมื่อ reject ให้ reset withdrawnAmount กลับ
        
        await tx.commission.update({
          where: { id: comm.id },
          data: {
            withdrawnAmount: 0, // Reset (ถ้าต้องการ partial ต้องเก็บ history)
            withdrawalId: null,
            status: 'AVAILABLE',
          },
        })
      }
    })

    // ============================================
    // ส่ง Email แจ้ง User
    // ============================================
    if (withdrawal.user?.email) {
      try {
        await sendWithdrawalRejectedEmail(withdrawal.user.email, {
          amount: withdrawal.amount / 100,
          bankCode: withdrawal.bankCode,
          accountNumber: withdrawal.accountNumber,
          accountName: withdrawal.accountName,
          date: withdrawal.createdAt,
          reason: reason,
        })
        console.log(`Sent rejection email to ${withdrawal.user.email}`)
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reject withdrawal error:', error)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}