// lib/free-window.ts
// FREE PLAN — time-windowed, pair-limited, count-capped viewing for non-paying users.
//
// Rules (Asia/Bangkok):
//   - Window:       20:00–21:00 (1 hour/day)
//   - Daily cap:    5 signals/day globally — counter visible to user ("3/5")
//   - Pairs:        EURUSD (EU) + USDJPY (UJ) only
//   - PIP:          disabled for free users
//   - Sound alert:  disabled for free users
//
// The date key is always the local Bangkok date so "today" matches user intuition.

export const FREE_WINDOW_START_HOUR = 20 // 20:00 Asia/Bangkok
export const FREE_WINDOW_END_HOUR = 21   // 21:00 Asia/Bangkok
export const FREE_DAILY_LIMIT = 5
// Broker symbols use an 'm' suffix. Keep that explicit here — mismatches silently
// break the whole gate, so we centralise both the broker keys and the display names.
export const FREE_PAIR_SYMBOLS = ['EURUSDm', 'USDJPYm'] as const
export const FREE_PAIR_DISPLAY = ['EURUSD', 'USDJPY'] as const

const BKK_TZ = 'Asia/Bangkok'

/**
 * Current hour + minute + second in Asia/Bangkok, regardless of the server TZ.
 * We walk Intl.DateTimeFormat parts rather than parse strings so DST / locale
 * quirks can't bite us (Thailand doesn't observe DST today, but don't rely on that).
 */
function bkkParts(now = new Date()): { y: number; m: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BKK_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10)
  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    h: get('hour'),
    mi: get('minute'),
    s: get('second'),
  }
}

/** YYYY-MM-DD in Asia/Bangkok. Used as the counter-aggregation key. */
export function getTodayKeyBkk(now = new Date()): string {
  const { y, m, d } = bkkParts(now)
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
}

/** True if wall-clock Bangkok time is inside [20:00, 21:00). */
export function isInFreeWindow(now = new Date()): boolean {
  const { h } = bkkParts(now)
  return h >= FREE_WINDOW_START_HOUR && h < FREE_WINDOW_END_HOUR
}

/** Seconds until the free window closes — negative/0 if already closed. */
export function secondsUntilFreeWindowEnd(now = new Date()): number {
  const { h, mi, s } = bkkParts(now)
  if (h >= FREE_WINDOW_END_HOUR) return 0
  if (h < FREE_WINDOW_START_HOUR) return 0
  const secsSinceMidnight = h * 3600 + mi * 60 + s
  const endSecs = FREE_WINDOW_END_HOUR * 3600
  return Math.max(0, endSecs - secsSinceMidnight)
}

/** Seconds until next free window start — 0 if already inside window. */
export function secondsUntilFreeWindowStart(now = new Date()): number {
  const { h, mi, s } = bkkParts(now)
  if (h >= FREE_WINDOW_START_HOUR && h < FREE_WINDOW_END_HOUR) return 0
  const secsSinceMidnight = h * 3600 + mi * 60 + s
  const startSecs = FREE_WINDOW_START_HOUR * 3600
  if (h < FREE_WINDOW_START_HOUR) return Math.max(0, startSecs - secsSinceMidnight)
  // past end → next day
  return 24 * 3600 - secsSinceMidnight + startSecs
}

export function isAllowedFreePair(symbol: string): boolean {
  return (FREE_PAIR_SYMBOLS as readonly string[]).includes(symbol)
}
