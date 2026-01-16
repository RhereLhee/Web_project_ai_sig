// lib/affiliate.ts
// Affiliate Commission Calculator - Linear Upline with Exponential Decay
// Pool = 300 บาท (30000 satang) ต่อ Order
// r = 0.8 (decay rate)

import { prisma } from './prisma'

// ============================================
// CONFIG
// ============================================

export const AFFILIATE_CONFIG = {
  POOL_AMOUNT: 30000,  // 300 บาท = 30000 satang
  DECAY_RATE: 0.8,     // r = 0.8
  MIN_COMMISSION: 100, // ขั้นต่ำ 1 บาท = 100 satang (ถ้าน้อยกว่านี้ไม่จ่าย)
}

// ============================================
// TYPES
// ============================================

interface UplineUser {
  id: string
  level: number  // 1 = ใกล้ผู้ซื้อที่สุด, 2, 3, ...
}

interface CommissionResult {
  userId: string
  level: number
  weight: number
  amount: number  // satang
}

// ============================================
// GET UPLINE CHAIN
// ============================================

/**
 * ดึงสายบนทั้งหมดของ user
 * @param userId - ID ของผู้ซื้อ
 * @returns Array ของ upline เรียงจากใกล้ไปไกล
 */
export async function getUplineChain(userId: string): Promise<UplineUser[]> {
  const uplines: UplineUser[] = []
  let currentUserId = userId
  let level = 0

  while (true) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { referredById: true },
    })

    if (!user || !user.referredById) {
      break
    }

    level++
    uplines.push({
      id: user.referredById,
      level,
    })

    currentUserId = user.referredById

    // Safety: ป้องกัน infinite loop (max 100 levels)
    if (level >= 100) break
  }

  return uplines
}

// ============================================
// CALCULATE COMMISSION
// ============================================

/**
 * คำนวณ Commission สำหรับแต่ละคนในสาย Upline
 * ใช้สูตร Exponential Decay:
 * - weight(n) = r^(n-1)
 * - payment(n) = POOL × weight(n) / Σweight
 * 
 * @param uplines - Array ของ upline
 * @returns Array ของ Commission แต่ละคน
 */
export function calculateCommissions(uplines: UplineUser[]): CommissionResult[] {
  if (uplines.length === 0) return []

  const { POOL_AMOUNT, DECAY_RATE, MIN_COMMISSION } = AFFILIATE_CONFIG

  // คำนวณ weight ของแต่ละคน
  const weights = uplines.map((u) => ({
    ...u,
    weight: Math.pow(DECAY_RATE, u.level - 1),
  }))

  // รวม weight ทั้งหมด
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)

  // คำนวณ Commission
  const commissions: CommissionResult[] = weights.map((w) => {
    const amount = Math.floor((POOL_AMOUNT * w.weight) / totalWeight)
    return {
      userId: w.id,
      level: w.level,
      weight: w.weight,
      amount,
    }
  })

  // กรองเฉพาะที่มากกว่า MIN_COMMISSION
  return commissions.filter((c) => c.amount >= MIN_COMMISSION)
}

// ============================================
// DISTRIBUTE COMMISSION
// ============================================

/**
 * แจก Commission ให้ Upline ทั้งหมด
 * เรียกใช้หลังจาก Admin อนุมัติ Order
 * 
 * @param orderId - ID ของ Order ที่อนุมัติ
 * @param buyerId - ID ของผู้ซื้อ
 * @returns จำนวน Commission ที่แจก
 */
export async function distributeCommission(
  orderId: string,
  buyerId: string
): Promise<{ success: boolean; distributed: number; commissions: CommissionResult[] }> {
  try {
    // 1. ดึงสาย Upline
    const uplines = await getUplineChain(buyerId)
    
    if (uplines.length === 0) {
      console.log(`[Affiliate] No upline for user ${buyerId}`)
      return { success: true, distributed: 0, commissions: [] }
    }

    // 2. คำนวณ Commission
    const commissions = calculateCommissions(uplines)
    
    if (commissions.length === 0) {
      console.log(`[Affiliate] No commissions to distribute`)
      return { success: true, distributed: 0, commissions: [] }
    }

    // คำนวณ totalWeight
    const totalWeight = commissions.reduce((sum, c) => sum + c.weight, 0)

    // 3. สร้าง AffiliatePayment record
    const affiliatePayment = await prisma.affiliatePayment.create({
      data: {
        orderId,
        totalPool: AFFILIATE_CONFIG.POOL_AMOUNT,
        decayRate: AFFILIATE_CONFIG.DECAY_RATE,
        totalLevels: commissions.length,
        totalWeight,
        status: 'COMPLETED',
        distributedAt: new Date(),
      },
    })

    // 4. สร้าง Commission records สำหรับแต่ละ Upline
    await prisma.commission.createMany({
      data: commissions.map((c) => ({
        affiliatePaymentId: affiliatePayment.id,
        userId: c.userId,
        amount: c.amount,
        amountBaht: c.amount / 100,
        level: c.level,
        weight: c.weight,
        normalizedWeight: c.weight / totalWeight,
        status: 'PENDING', // รอถอน
      })),
    })

    console.log(`[Affiliate] Distributed ${commissions.length} commissions for order ${orderId}`)
    console.log(`[Affiliate] Total: ${commissions.reduce((s, c) => s + c.amount, 0)} satang`)

    return {
      success: true,
      distributed: commissions.length,
      commissions,
    }

  } catch (error) {
    console.error('[Affiliate] Error distributing commission:', error)
    return { success: false, distributed: 0, commissions: [] }
  }
}

// ============================================
// HELPER: GET USER BALANCE
// ============================================

/**
 * ดึงยอดคงเหลือของ user (Commission ที่ยังไม่ถอน)
 */
export async function getUserAffiliateBalance(userId: string): Promise<number> {
  const result = await prisma.commission.aggregate({
    where: {
      userId,
      status: 'PENDING',
    },
    _sum: {
      amount: true,
    },
  })

  return result._sum.amount || 0
}

// ============================================
// HELPER: MARK COMMISSIONS AS WITHDRAWN
// ============================================

/**
 * Mark Commission เป็น WITHDRAWN หลังถอนสำเร็จ
 */
export async function markCommissionsWithdrawn(
  userId: string,
  withdrawalId: string,
  amount: number
): Promise<void> {
  // หา Commission ที่ยัง PENDING
  const pendingCommissions = await prisma.commission.findMany({
    where: {
      userId,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'asc' },
  })

  let remaining = amount
  const idsToUpdate: string[] = []

  for (const comm of pendingCommissions) {
    if (remaining <= 0) break
    idsToUpdate.push(comm.id)
    remaining -= comm.amount
  }

  // Update status
  await prisma.commission.updateMany({
    where: {
      id: { in: idsToUpdate },
    },
    data: {
      status: 'WITHDRAWN',
      paidAt: new Date(),
    },
  })
}