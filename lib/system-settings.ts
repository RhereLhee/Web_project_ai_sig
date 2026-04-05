// lib/system-settings.ts
// Helper สำหรับดึงค่า System Settings จาก DB
// ใช้ cache ระดับ request (ไม่ query ซ้ำใน request เดียวกัน)

import { prisma } from './prisma'

const DEFAULTS: Record<string, unknown> = {
  'free_trial_enabled': true,
  'free_trial_days': 30,
  'affiliate_enabled': false,
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
  return settings['affiliate_enabled'] === true
}

// เรียกเมื่อ admin เปลี่ยนค่า เพื่อ invalidate cache
export function invalidateSettingsCache(): void {
  cachedSettings = null
  cacheTimestamp = 0
}
