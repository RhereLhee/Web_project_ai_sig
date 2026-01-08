import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/jwt'
import { getUserWithSubscription, hasActiveSubscription, hasSignalAccess } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // เช็คเงื่อนไข Signal + PRO
    const user = await getUserWithSubscription()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const hasSub = hasActiveSubscription(user)
    const hasSignal = hasSignalAccess(user)

    if (!hasSub || !hasSignal) {
      return NextResponse.json(
        { error: 'ต้องมีทั้ง Signal Access และ PRO Subscription ถึงจะถอนเงินได้' },
        { status: 403 }
      )
    }

    const { amount, bankName, accountNumber, accountName } = await req.json()

    // Validation
    if (!amount || !bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      )
    }

    const minAmount = 35000 // 350 บาท = 35000 satang
    if (amount < minAmount) {
      return NextResponse.json(
        { error: `ขั้นต่ำในการถอนคือ ฿${minAmount / 100}` },
        { status: 400 }
      )
    }

    // เช็คยอดคงเหลือ
    const balance = await prisma.commission.aggregate({
      where: {
        userId: user.id,
        status: 'PENDING',
      },
      _sum: {
        amount: true,
      },
    })

    const availableBalance = balance._sum.amount || 0

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: 'ยอดเงินไม่เพียงพอ' },
        { status: 400 }
      )
    }

    // สร้างคำขอถอน
    const withdrawal = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        amount,
        bankName,
        accountNumber,
        accountName,
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      withdrawal,
    })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}

// GET - ดูประวัติการถอน
export async function GET(req: NextRequest) {
  try {
    const payload = await getCurrentUser()
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ withdrawals })
  } catch (error) {
    console.error('Get withdrawals error:', error)
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด' },
      { status: 500 }
    )
  }
}