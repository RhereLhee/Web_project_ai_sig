// app/api/withdrawal/request/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/jwt"
import { prisma } from "@/lib/prisma"
import { getUserAffiliateBalance } from "@/lib/affiliate"
import { 
  validateThaiPhone, 
  validateBankAccount, 
  validateAccountName,
  validateWithdrawAmount 
} from "@/lib/validators"

// ============================================
// CONFIG
// ============================================

const WITHDRAWAL_CONFIG = {
  minAmount: 100,  // ขั้นต่ำ 100 บาท
}

// ============================================
// POST - Request Withdrawal
// ============================================

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { amount, phone, bankCode, accountNumber, accountName } = body

    // ============================================
    // 1. GET USER & PARTNER
    // ============================================
    
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        partner: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "ไม่พบข้อมูลผู้ใช้" }, { status: 404 })
    }

    // ต้องเป็น Partner ถึงจะถอนได้
    if (!user.partner || user.partner.status !== 'ACTIVE') {
      return NextResponse.json({ 
        error: "ต้องเป็น Partner ที่ Active ถึงจะถอนเงินได้" 
      }, { status: 403 })
    }

    // ============================================
    // 2. VALIDATE PHONE
    // ============================================
    
    const phoneValidation = validateThaiPhone(phone)
    if (!phoneValidation.valid) {
      return NextResponse.json({ error: phoneValidation.error }, { status: 400 })
    }

    const formattedPhone = phoneValidation.formatted!

    // เช็คว่ามีเบอร์ล็อคไว้หรือยัง
    if (user.partner.withdrawPhone) {
      // ถ้ามีแล้ว ต้องตรงกับเบอร์ที่ล็อค
      if (user.partner.withdrawPhone !== formattedPhone) {
        return NextResponse.json({ 
          error: "เบอร์โทรไม่ตรงกับที่ผูกไว้" 
        }, { status: 400 })
      }
    }

    // ============================================
    // 3. VALIDATE BANK ACCOUNT
    // ============================================
    
    const accountValidation = validateBankAccount(accountNumber, bankCode)
    if (!accountValidation.valid) {
      return NextResponse.json({ error: accountValidation.error }, { status: 400 })
    }

    const nameValidation = validateAccountName(accountName)
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 })
    }

    // ============================================
    // 4. VALIDATE AMOUNT
    // ============================================
    
    // ดึงยอดคงเหลือ (satang)
    const balanceSatang = await getUserAffiliateBalance(user.id)
    const balanceBaht = balanceSatang / 100
    
    // amount ที่ส่งมาเป็นบาท
    const amountValidation = validateWithdrawAmount(
      amount, 
      balanceBaht, 
      WITHDRAWAL_CONFIG.minAmount
    )
    
    if (!amountValidation.valid) {
      return NextResponse.json({ error: amountValidation.error }, { status: 400 })
    }

    // ============================================
    // 5. LOCK PHONE (ถ้ายังไม่มี)
    // ============================================
    
    if (!user.partner.withdrawPhone) {
      await prisma.partner.update({
        where: { id: user.partner.id },
        data: { 
          withdrawPhone: formattedPhone,
          withdrawPhoneLockedAt: new Date(),
        },
      })
    }

    // ============================================
    // 6. CREATE WITHDRAWAL REQUEST
    // ============================================
    
    const withdrawalNumber = `WD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const withdrawal = await prisma.withdrawal.create({
      data: {
        withdrawalNumber,
        userId: user.id,
        partnerId: user.partner.id,
        amount: amount * 100, // เก็บเป็น satang
        amountBaht: amount,
        bankCode,
        accountNumber: accountValidation.formatted!,
        accountName: nameValidation.formatted!,
        phone: formattedPhone,
        status: 'PENDING',
      },
    })

    // ============================================
    // 7. RESPONSE
    // ============================================
    
    return NextResponse.json({
      success: true,
      withdrawal: {
        id: withdrawal.id,
        withdrawalNumber: withdrawal.withdrawalNumber,
        amount: withdrawal.amountBaht,
        status: withdrawal.status,
      },
      message: "สร้างคำขอถอนเงินสำเร็จ รอ Admin อนุมัติ",
    })

  } catch (error) {
    console.error("Withdrawal request error:", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 })
  }
}

// ============================================
// GET - Get User's Withdrawal Info
// ============================================

export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        partner: {
          select: {
            id: true,
            status: true,
            withdrawPhone: true,
            withdrawPhoneLockedAt: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "ไม่พบข้อมูลผู้ใช้" }, { status: 404 })
    }

    // ดึงยอดคงเหลือ
    const balanceSatang = await getUserAffiliateBalance(user.id)
    const balanceBaht = balanceSatang / 100

    // ดึงประวัติการถอน
    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      balance: balanceBaht,
      balanceSatang,
      minWithdraw: WITHDRAWAL_CONFIG.minAmount,
      partner: user.partner,
      hasLockedPhone: !!user.partner?.withdrawPhone,
      lockedPhone: user.partner?.withdrawPhone || null,
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        withdrawalNumber: w.withdrawalNumber,
        amount: w.amountBaht,
        status: w.status,
        createdAt: w.createdAt,
        paidAt: w.paidAt,
      })),
    })

  } catch (error) {
    console.error("Get withdrawal info error:", error)
    return NextResponse.json({ error: "เกิดข้อผิดพลาด" }, { status: 500 })
  }
}