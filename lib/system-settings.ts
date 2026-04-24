// lib/system-settings.ts
// Helper สำหรับดึงค่า System Settings จาก DB
// ใช้ cache ระดับ process (refresh ทุก 60 วินาที)

import { prisma } from './prisma'
import { MONEY_DEFAULTS, MONEY_SETTING_KEYS } from './money'

const DEFAULTS: Record<string, unknown> = {
  free_trial_enabled: true,
  free_trial_days: 30,
  ...MONEY_DEFAULTS,
}

// In-memory cache (refresh ทุก 60 วินาที)
let cachedSettings: Record<string, unknown> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000 // 60 วินาที

async function loadSettings(): Promise<Record<string, unknown>> {
  if (cachedSettings && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedSettings
  }

  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: Object.keys(DEFAULTS) } },
    })

    const result: Record<string, unknown> = { ...DEFAULTS }
    for (const s of settings) {
      result[s.key] = s.value
    }

    cachedSettings = result
    cacheTimestamp = Date.now()
    return result
  } catch {
    return { ...DEFAULTS }
  }
}

export async function isFreeTrial(): Promise<boolean> {
  const settings = await loadSettings()
  return settings['free_trial_enabled'] === true
}

export async function getFreeTrialDays(): Promise<number> {
  const settings = await loadSettings()
  return (settings['free_trial_days'] as number) || 30
}

export async function isAffiliateEnabled(): Promise<boolean> {
  const settings = await loadSettings()
  return settings[MONEY_SETTING_KEYS.AFFILIATE_ENABLED] === true
}

// ============================================
// MONEY SETTINGS (banking-critical)
// ============================================

/** Integer guard: coerce Json value to integer satang, fall back to default. */
function asInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10)
  return fallback
}

/** Percent guard: 0..100 only. */
function asPercent(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (Number.isFinite(n) && n >= 0 && n <= 100) return n
  return fallback
}

export async function getVipPriceSatang(): Promise<number> {
  const settings = await loadSettings()
  return asInt(
    settings[MONEY_SETTING_KEYS.VIP_PRICE_SATANG],
    MONEY_DEFAULTS[MONEY_SETTING_KEYS.VIP_PRICE_SATANG],
  )
}

export async function getAffiliatePoolPercent(): Promise<number> {
  const settings = await loadSettings()
  return asPercent(
    settings[MONEY_SETTING_KEYS.AFFILIATE_POOL_PERCENT],
    MONEY_DEFAULTS[MONEY_SETTING_KEYS.AFFILIATE_POOL_PERCENT],
  )
}

export async function getMinWithdrawSatang(): Promise<number> {
  const settings = await loadSettings()
  return asInt(
    settings[MONEY_SETTING_KEYS.MIN_WITHDRAW_SATANG],
    MONEY_DEFAULTS[MONEY_SETTING_KEYS.MIN_WITHDRAW_SATANG],
  )
}

// เรียกเมื่อ admin เปลี่ยนค่า เพื่อ invalidate cache
export function invalidateSettingsCache(): void {
  cachedSettings = null
  cacheTimestamp = 0
}
