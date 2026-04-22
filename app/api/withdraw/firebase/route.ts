// app/api/withdraw/firebase/route.ts
// Withdraw API - ใช้ withdrawnAmount pattern (ไม่ split row)

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { getUserWithSubscription, hasActivePartner } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // ต้องเป็น Partner Active
    if (!hasActivePartner(user)) {
      return NextResponse.json(
        { error: 'ต้องเป็น Partner ถึงจะถอนเงินได้' },
        { status: 403 }
      )
    }

    const { amount, phone, bankCode, accountNumber, accountName } = await req.json()

    // ============================================
    // 1. VALIDATION
    // ============================================
    if (!bankCode || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    // ============================================
    // 2. GET PARTNER + USER PHONE
    // ============================================
    const partner = await prisma.partner.findUnique({
      where: { userId: user.id },
    })

    if (!partner) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูล Partner' },
        { status: 404 }
      )
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true },
    })

    // ============================================
    // 3. CALCULATE AVAILABLE BALANCE
    // available = SUM(amount - withdrawnAmount) where status = AVAILABLE
    // ============================================
    const commissions = await prisma.commission.findMany({
      where: {
        userId: user.id,
        status: 'AVAILABLE',
      },
      orderBy: { createdAt: 'asc' },
    })

    const availableBalance = commissions.reduce(
      (sum, c) => sum + (c.amount - c.withdrawnAmount), 
      0
    )

    if (availableBalance <= 0) {
      return NextResponse.json(
        { error: 'ไม่มียอดเงินที่สามารถถอนได้' },
        { status: 400 }
      )
    }

    // ============================================
    // 4. VALIDATE AMOUNT
    // ============================================
    const minAmount = 10000 // 100 บาท = 10000 satang
    const requestedAmountSatang = Math.round((amount || 0) * 100)
    
    if (requestedAmountSatang < minAmount) {
      return NextResponse.json(
        { error: `ขั้นต่ำในการถอนคือ ฿${minAmount / 100}` },
        { status: 400 }
      )
    }

    if (requestedAmountSatang > availableBalance) {
      return NextResponse.json(
        { error: 'ยอดเงินไม่เพียงพอ' },
        { status: 400 }
      )
    }

    // ============================================
    // 5. PHONE LOCK (1 เบอร์ = 1 บัญชี)
    // ============================================
    let finalPhone: string

    if (partner.withdrawPhone) {
      finalPhone = partner.withdrawPhone
    } else {
      const phoneToUse = phone || userData?.phone
      
      if (!phoneToUse) {
        return NextResponse.json(
          { error: 'กรุณาระบุเบอร์โทรศัพท์' },
          { status: 400 }
        )
      }

      let formattedPhone = phoneToUse.replace(/\D/g, '')
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '66' + formattedPhone.slice(1)
      }
      if (!formattedPhone.startsWith('66')) {
        formattedPhone = '66' + formattedPhone
      }

      const otherPartnerWithPhone = await prisma.partner.findFirst({
        where: {
          withdrawPhone: formattedPhone,
          userId: { not: user.id },
        },
      })

      if (otherPartnerWithPhone) {
        return NextResponse.json(
          { error: 'เบอร์โทรนี้ถูกใช้กับบัญชีอื่นแล้ว' },
          { status: 400 }
        )
      }

      await prisma.partner.update({
        where: { id: partner.id },
        data: {
          withdrawPhone: formattedPhone,
          withdrawPhoneLockedAt: new Date(),
        },
      })

      finalPhone = formattedPhone
    }

    // ============================================
    // 6. CREATE WITHDRAWAL + UPDATE COMMISSIONS (Transaction)
    // ============================================
    const result = await prisma.$transaction(async (tx) => {
      // 1. สร้าง Withdrawal
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId: user.id,
          partnerId: partner.id,
          amount: requestedAmountSatang,
          amountBaht: requestedAmountSatang / 100,
          bankCode,
          accountNumber,
          accountName,
          phone: finalPhone,
          status: 'PENDING',
        },
      })

      // 2. Update withdrawnAmount ใน Commission (FIFO)
      let remainingToWithdraw = requestedAmountSatang

      for (const comm of commissions) {
        if (remainingToWithdraw <= 0) break

        const availableInThisComm = comm.amount - comm.withdrawnAmount
        if (availableInThisComm <= 0) continue

        const toWithdrawFromThis = Math.min(remainingToWithdraw, availableInThisComm)
        const newWithdrawnAmount = comm.withdrawnAmount + toWithdrawFromThis

        // Update commission
        await tx.commission.update({
          where: { id: comm.id },
          data: {
            withdrawnAmount: newWithdrawnAmount,
            withdrawalId: withdrawal.id,
            // ถ้าถอนหมดแล้ว status = FULLY_WITHDRAWN
            status: newWithdrawnAmount >= comm.amount ? 'FULLY_WITHDRAWN' : 'AVAILABLE',
          },
        })

        remainingToWithdraw -= toWithdrawFromThis
      }

      return withdrawal
    })

    return NextResponse.json({
      success: true,
      message: 'ส่งคำขอถอนเงินแล้ว รอ Admin อนุมัติ 1-3 วันทำการ',
      withdrawal: {
        id: result.id,
        amount: result.amount,
        amountBaht: result.amountBaht,
        status: result.status,
      },
    })

  } catch (error) {
    console.error('Withdraw Firebase error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}