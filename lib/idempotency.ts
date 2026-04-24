// lib/idempotency.ts
// Generic idempotency wrapper. Stores response for 24h.

import { prisma } from './prisma'
import type { NextRequest } from 'next/server'

const TTL_MS = 24 * 60 * 60 * 1000

export type IdempotencyScope =
  | 'order_approve'
  | 'withdraw_create'
  | 'withdraw_approve'
  | 'withdraw_paid'
  | 'withdraw_reject'
  | 'slipok_webhook'
  | 'slip_upload'

export interface IdempotencyResult<T> {
  cached: boolean
  statusCode: number
  response: T
}

/** Extract idempotency key from request header, or from a fallback generator.
 *  Clients should send `Idempotency-Key: <uuid>` on mutating requests. */
export function getIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get('idempotency-key') || req.headers.get('x-idempotency-key')
}

/** Try to return a cached response. Returns null if no key or no cached entry. */
export async function getCached<T = unknown>(
  key: string | null,
  scope: IdempotencyScope,
): Promise<IdempotencyResult<T> | null> {
  if (!key) return null
  const row = await prisma.idempotencyKey.findUnique({ where: { key } })
  if (!row) return null
  if (row.scope !== scope) {
    throw new Error(`Idempotency key ${key} reused across scopes (${row.scope} vs ${scope})`)
  }
  if (row.expiresAt < new Date()) return null
  return {
    cached: true,
    statusCode: row.statusCode,
    response: row.response as T,
  }
}

/** Store a response under an idempotency key. Safe to call with null key (no-op). */
export async function storeResponse<T>(
  key: string | null,
  scope: IdempotencyScope,
  statusCode: number,
  response: T,
): Promise<void> {
  if (!key) return
  await prisma.idempotencyKey.upsert({
    where: { key },
    create: {
      key,
      scope,
      statusCode,
      response: response as object,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
    update: {
      // Once stored, do not overwrite — idempotency guarantee
      // But if expired, allow overwrite via delete+create pattern in caller
    },
  })
}

/** Convenience wrapper for API handlers. */
export async function withIdempotency<T>(
  key: string | null,
  scope: IdempotencyScope,
  fn: () => Promise<{ statusCode: number; body: T }>,
): Promise<{ statusCode: number; body: T; cached: boolean }> {
  const cached = await getCached<T>(key, scope)
  if (cached) {
    return { statusCode: cached.statusCode, body: cached.response, cached: true }
  }
  const result = await fn()
  await storeResponse(key, scope, result.statusCode, result.body)
  return { ...result, cached: false }
}
