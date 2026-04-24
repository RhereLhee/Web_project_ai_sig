import { getCurrentUser } from './jwt'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'
import { UserRole } from '@prisma/client'

export type UserWithSub = {
  id: string
  email: string | null
  name: string | null
  role: UserRole
  referralCode: string
  partner: {
    status: string
    endDate: Date | null
    bankName: string
    accountNumber: string
    accountName: string
  } | null
  signalSubscription: {
    status: string
    endDate: Date | null
  } | null
}

export async function getUserWithSubscription(): Promise<UserWithSub | null> {
  const payload = await getCurrentUser()
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      referralCode: true,
      // Partner (เดิมคือ Subscription)
      partner: {
        select: {
          status: true,
          endDate: true,
          bankName: true,
          accountNumber: true,
          accountName: true,
        }
      },
      // Signal Subscription
      signalSubscriptions: {
        where: { status: 'ACTIVE' },
        orderBy: { endDate: 'desc' },
        take: 1,
        select: {
          status: true,
          endDate: true,
        }
      }
    }
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    referralCode: user.referralCode,
    partner: user.partner || null,
    signalSubscription: user.signalSubscriptions[0] || null,
  }
}

// Partner gate removed: anyone logged in counts as "active partner".
// Partner table is still used for bank-info / withdrawal metadata only.
// To restore paid-Partner gating, revert this helper to its status+endDate check.
export function hasActivePartner(user: UserWithSub | null): boolean {
  return !!user
}

// True when the user has actually registered Partner bank info.
// Use this (not hasActivePartner) when you need to verify bank details exist
// before allowing a withdrawal.
export function hasPartnerBankInfo(user: UserWithSub | null): boolean {
  if (!user || !user.partner) return false
  return !!(user.partner.bankName && user.partner.accountNumber && user.partner.accountName)
}

// ตรวจว่ามี Signal Access (Signal Room)
export function hasSignalAccess(user: UserWithSub | null): boolean {
  if (!user || !user.signalSubscription) return false
  if (user.signalSubscription.status !== 'ACTIVE') return false
  if (!user.signalSubscription.endDate) return true
  return new Date(user.signalSubscription.endDate) > new Date()
}

export async function requireAuth() {
  const user = await getUserWithSubscription()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== 'ADMIN') redirect('/dashboard')
  return user
}

// ใช้สำหรับหน้าที่ต้องมี Partner
// Partner gate is removed — this now only enforces login.
// Preserved for backward compatibility with existing callers.
export async function requirePartner() {
  const user = await getUserWithSubscription()
  if (!user) redirect('/login')
  return user
}

// ใช้สำหรับหน้าที่ต้องมี Signal Access
export async function requireSignalAccess() {
  const user = await getUserWithSubscription()
  if (!user) redirect('/login')
  if (!hasSignalAccess(user)) redirect('/signals')
  return user
}

// Alias สำหรับ backward compatibility
export const hasActiveSubscription = hasActivePartner