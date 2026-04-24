// lib/money.ts
// Banking-grade money constants and helpers.
// All monetary values are stored as Int satang (1/100 THB) unless marked otherwise.
// Never use Float for arithmetic on money.

// ============================================
// HARD-CODED INVARIANTS (cannot be changed via admin UI)
// ============================================

/** Minimum commission to distribute — below this we drop (avoid 0-baht dust records). */
export const MIN_COMMISSION_SATANG = 100 // 1 THB

/** Exponential decay rate for affiliate pool distribution. Linear upline. */
export const AFFILIATE_DECAY_RATE = 0.8

/** Safety cap on upline chain depth (prevents infinite loops from corrupted referral graph). */
export const MAX_UPLINE_LEVELS = 100

/** Unique-amount suffix range: 1..99 satang appended to expected payment amount
 *  to disambiguate simultaneous transfers of the same price. */
export const AMOUNT_SUFFIX_MIN = 1
export const AMOUNT_SUFFIX_MAX = 99

/** Order payment TTL: user must pay within this window. */
export const ORDER_PAYMENT_TTL_MS = 30 * 60 * 1000 // 30 minutes

// ============================================
// DEFAULTS FOR SystemSetting (admin can override)
// ============================================

export const MONEY_SETTING_KEYS = {
  VIP_PRICE_SATANG: 'vip_price_satang', // 49900 = 499 THB
  AFFILIATE_POOL_PERCENT: 'affiliate_pool_percent', // 30 (= 30% of order)
  MIN_WITHDRAW_SATANG: 'min_withdraw_satang', // 30000 = 300 THB
  AFFILIATE_ENABLED: 'affiliate_enabled', // boolean
} as const

export const MONEY_DEFAULTS = {
  [MONEY_SETTING_KEYS.VIP_PRICE_SATANG]: 49900,
  [MONEY_SETTING_KEYS.AFFILIATE_POOL_PERCENT]: 30,
  [MONEY_SETTING_KEYS.MIN_WITHDRAW_SATANG]: 30000,
  [MONEY_SETTING_KEYS.AFFILIATE_ENABLED]: false,
} as const

// ============================================
// PURE HELPERS
// ============================================

/** Compute affiliate pool for an order.
 *  pool = floor(orderAmountSatang * percent / 100)
 *  Floor is intentional: we never over-allocate.
 */
export function computePoolSatang(orderAmountSatang: number, percent: number): number {
  if (!Number.isInteger(orderAmountSatang) || orderAmountSatang < 0) {
    throw new Error(`Invalid orderAmountSatang: ${orderAmountSatang}`)
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(`Invalid percent: ${percent}`)
  }
  return Math.floor((orderAmountSatang * percent) / 100)
}

/** Generate a unique-amount suffix (1..99 satang) using crypto-strong randomness.
 *  Returns satang to add to base price so two simultaneous orders for the same plan
 *  have different expected amounts.
 */
export function generateAmountSuffix(): number {
  // 1..99 inclusive
  const range = AMOUNT_SUFFIX_MAX - AMOUNT_SUFFIX_MIN + 1
  // Node/Edge: globalThis.crypto is available
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return AMOUNT_SUFFIX_MIN + (buf[0] % range)
}

/** Convert satang -> baht string for display (never used for arithmetic).
 *  e.g. 49937 -> "499.37"
 */
export function formatBaht(satang: number): string {
  const sign = satang < 0 ? '-' : ''
  const abs = Math.abs(satang)
  const baht = Math.floor(abs / 100)
  const sat = abs % 100
  return `${sign}${baht.toLocaleString('en-US')}.${sat.toString().padStart(2, '0')}`
}

/** Parse a satang amount from a baht-string input. Strict. */
export function parseBahtToSatang(input: string): number {
  const trimmed = input.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid baht input: ${input}`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  const padded = (frac + '00').slice(0, 2)
  const signed = Number(whole) < 0 || whole === '-0'
  const abs = Math.abs(Number(whole)) * 100 + Number(padded)
  return signed ? -abs : abs
}

/** Validate that an order amount matches an expected amount exactly.
 *  Banking rule: we NEVER accept "amount >= expected". Must be exact. */
export function matchesExpectedAmount(actualSatang: number, expectedSatang: number): boolean {
  return Number.isInteger(actualSatang) && actualSatang === expectedSatang
}
