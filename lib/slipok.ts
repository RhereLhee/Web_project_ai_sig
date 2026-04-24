// lib/slipok.ts
// SlipOK integration — OCR + bank verification for Thai transfer slips.
// https://slipok.com (docs: https://developer.slipok.com/)
//
// Design goals:
//   - NEVER block the upload flow. If SlipOK is unreachable / misconfigured / returns an error,
//     we still store the slip and let an admin approve manually. The SlipVerification row
//     captures the outcome so the admin UI can surface it.
//   - Enforce slip-reuse prevention via fileSha256 UNIQUE (DB) BEFORE calling SlipOK.
//   - Enforce provider-transRef uniqueness via providerRef UNIQUE (DB) — protects against
//     the same slip being submitted against a different order.
//   - Store the raw provider response so disputes can be replayed.
//
// Env:
//   SLIPOK_ENABLED          — "true" to call the API; otherwise returns MANUAL
//   SLIPOK_API_URL          — full URL including branch, e.g. https://api.slipok.com/api/line/apikey/<BRANCH_ID>
//   SLIPOK_API_KEY          — branch-specific x-authorization header
//   SLIPOK_EXPECTED_RECEIVER — (optional) account-number substring to verify receiver matches us

import crypto from 'crypto'

export type SlipVerifyStatus = 'VERIFIED' | 'REJECTED' | 'PENDING' | 'MANUAL'

export interface SlipVerifyInput {
  fileBuffer: Buffer
  fileMime: string
  expectedAmountSatang: number // finalAmount + amountSuffix — must match EXACTLY
}

export interface SlipVerifyParsed {
  amountSatang?: number | null
  senderBank?: string | null
  senderName?: string | null
  senderAccount?: string | null
  receiverBank?: string | null
  receiverName?: string | null
  receiverAccount?: string | null
  transferAt?: Date | null
  providerRef?: string | null
}

export interface SlipVerifyResult {
  status: SlipVerifyStatus
  errorMessage?: string | null
  provider: 'slipok' | 'manual'
  fileSha256: string
  parsed: SlipVerifyParsed
  rawResponse?: unknown
}

export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function isEnabled(): boolean {
  return (
    process.env.SLIPOK_ENABLED === 'true' &&
    !!process.env.SLIPOK_API_URL &&
    !!process.env.SLIPOK_API_KEY
  )
}

/**
 * Parse the SlipOK `data` object into our schema shape.
 * SlipOK returns amount as a number in baht with 2 decimals — convert to satang integer.
 */
function parseSlipOkData(raw: unknown): SlipVerifyParsed {
  const data = (raw as { data?: Record<string, unknown> } | null)?.data
  if (!data) return {}

  // Amount: baht as number (e.g. 199.25) → satang integer (19925).
  const amountBaht = typeof data.amount === 'number' ? data.amount : Number(data.amount)
  const amountSatang = Number.isFinite(amountBaht) ? Math.round(amountBaht * 100) : null

  // transTimestamp is ISO; fall back to transDate + transTime concat.
  let transferAt: Date | null = null
  if (typeof data.transTimestamp === 'string') {
    const d = new Date(data.transTimestamp)
    transferAt = isNaN(d.getTime()) ? null : d
  } else if (typeof data.transDate === 'string') {
    const dt = typeof data.transTime === 'string'
      ? `${data.transDate}T${data.transTime}`
      : data.transDate
    const d = new Date(dt)
    transferAt = isNaN(d.getTime()) ? null : d
  }

  const sender = (data.sender as Record<string, unknown> | undefined) || {}
  const receiver = (data.receiver as Record<string, unknown> | undefined) || {}

  return {
    amountSatang,
    senderBank: (sender.bank as string) || (sender.bankShortName as string) || null,
    senderName: (sender.name as string) || (sender.displayName as string) || null,
    senderAccount: (sender.account as string) || (sender.accountNumber as string) || null,
    receiverBank: (receiver.bank as string) || (receiver.bankShortName as string) || null,
    receiverName: (receiver.name as string) || (receiver.displayName as string) || null,
    receiverAccount:
      (receiver.account as string) || (receiver.accountNumber as string) || null,
    transferAt,
    providerRef: (data.transRef as string) || (data.transactionId as string) || null,
  }
}

/**
 * Call SlipOK with the uploaded file. Never throws on API failures — returns
 * MANUAL status so admin can fall back to eyeball review.
 */
export async function verifySlip(input: SlipVerifyInput): Promise<SlipVerifyResult> {
  const fileSha256 = sha256(input.fileBuffer)

  if (!isEnabled()) {
    return {
      status: 'MANUAL',
      errorMessage: 'SlipOK disabled — falling back to manual review',
      provider: 'manual',
      fileSha256,
      parsed: {},
    }
  }

  const url = process.env.SLIPOK_API_URL!
  const apiKey = process.env.SLIPOK_API_KEY!

  try {
    const form = new FormData()
    // SlipOK accepts the file under field name `files` (v2) or `file` — use `files`.
    const blob = new Blob([new Uint8Array(input.fileBuffer)], { type: input.fileMime })
    form.append('files', blob, 'slip')
    form.append('amount', (input.expectedAmountSatang / 100).toFixed(2))
    form.append('log', 'true')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'x-authorization': apiKey },
        body: form,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const json: unknown = await res.json().catch(() => null)

    if (!res.ok) {
      // SlipOK error shape: { success: false, code: number, message: string }
      const msg =
        (json as { message?: string } | null)?.message ||
        `SlipOK HTTP ${res.status}`
      return {
        status: 'REJECTED',
        errorMessage: msg,
        provider: 'slipok',
        fileSha256,
        parsed: {},
        rawResponse: json,
      }
    }

    const parsed = parseSlipOkData(json)

    // Amount match check — MUST be exact-satang. Anything else is REJECTED and
    // forces admin review (don't auto-approve mismatched amounts).
    if (
      parsed.amountSatang == null ||
      parsed.amountSatang !== input.expectedAmountSatang
    ) {
      return {
        status: 'REJECTED',
        errorMessage:
          parsed.amountSatang == null
            ? 'ไม่สามารถอ่านยอดจากสลิปได้'
            : `ยอดในสลิปไม่ตรง (ได้ ฿${(parsed.amountSatang / 100).toFixed(2)} · ต้องการ ฿${(input.expectedAmountSatang / 100).toFixed(2)})`,
        provider: 'slipok',
        fileSha256,
        parsed,
        rawResponse: json,
      }
    }

    // Receiver check (optional, configured via env)
    const expectedReceiver = process.env.SLIPOK_EXPECTED_RECEIVER
    if (expectedReceiver && parsed.receiverAccount) {
      const normalizedReceiver = parsed.receiverAccount.replace(/[^0-9Xx*]/g, '')
      const normalizedExpected = expectedReceiver.replace(/[^0-9]/g, '')
      // SlipOK masks account numbers with 'x' — compare visible digits only.
      const visibleMatch = normalizedReceiver
        .split('')
        .every((ch, i) => {
          if (ch.toLowerCase() === 'x' || ch === '*') return true
          return normalizedExpected[i] === ch
        })
      if (!visibleMatch) {
        return {
          status: 'REJECTED',
          errorMessage: `บัญชีผู้รับไม่ตรง (สลิป: ${parsed.receiverAccount})`,
          provider: 'slipok',
          fileSha256,
          parsed,
          rawResponse: json,
        }
      }
    }

    return {
      status: 'VERIFIED',
      errorMessage: null,
      provider: 'slipok',
      fileSha256,
      parsed,
      rawResponse: json,
    }
  } catch (e) {
    // Network/timeout — don't block the upload. Admin can still approve by hand.
    return {
      status: 'MANUAL',
      errorMessage: `SlipOK call failed — manual review required: ${e instanceof Error ? e.message : String(e)}`,
      provider: 'manual',
      fileSha256,
      parsed: {},
    }
  }
}
