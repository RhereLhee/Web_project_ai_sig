// lib/retry.ts
// Retry Utility — แนวคิดจาก n8n: API สะดุดได้ ต้องมี retry รองรับ
// ใช้สำหรับ external API calls (SMS, Email, Telegram, Trading API)

import { logger } from '@/lib/logger'

interface RetryOptions {
  maxRetries?: number       // จำนวนครั้งที่ retry (default: 3)
  delayMs?: number          // delay เริ่มต้น (default: 1000ms)
  backoff?: boolean         // exponential backoff (default: true)
  context?: string          // ชื่อ context สำหรับ logging
  onRetry?: (attempt: number, error: unknown) => void
}

/**
 * Retry wrapper สำหรับ async function
 * ใช้ exponential backoff เพื่อไม่ให้ DDoS external service
 *
 * ตัวอย่าง:
 * const result = await withRetry(() => sendSMS(phone, msg), { context: 'sms', maxRetries: 3 })
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoff = true,
    context = 'unknown',
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt > maxRetries) {
        logger.error(`All ${maxRetries} retries failed`, {
          context,
          error,
          metadata: { attempt, maxRetries },
        })
        break
      }

      const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs

      logger.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms`, {
        context,
        error,
        metadata: { attempt, delay },
      })

      if (onRetry) {
        onRetry(attempt, error)
      }

      await sleep(delay)
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry wrapper สำหรับ fetch — จะ retry เฉพาะ network error หรือ 5xx
 * ไม่ retry 4xx เพราะเป็น client error
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, init)

    // retry เฉพาะ server error (5xx)
    if (response.status >= 500) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return response
  }, { context: options.context || 'fetch', ...options })
}
