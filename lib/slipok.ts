// lib/slipok.ts
// EasySlip integration — OCR + bank verification for Thai transfer slips.
// https://developer.easyslip.app
//
// Design goals:
//   - NEVER block the upload flow. If EasySlip is unreachable / misconfigured / returns an error,
//     we still store the slip and let an admin approve manually. The SlipVerification row
//     captures the outcome so the admin UI can surface it.
//   - Enforce slip-reuse prevention via fileSha256 UNIQUE (DB) BEFORE calling EasySlip.
//   - Enforce provider-transRef uniqueness via providerRef UNIQUE (DB) — protects against
//     the same slip being submitted against a different order.
//   - Store the raw provider response so disputes can be replayed.
//
// Env:
//   EASYSLIP_ENABLED          — "true" to call the API; otherwise returns MANUAL
//   EASYSLIP_API_KEY          — API Secret from EasySlip dashboard
//   EASYSLIP_EXPECTED_RECEIVER — (optional) account-number substring to verify receiver matches us

import crypto from 'crypto'

export type SlipVerifyStatus = 'VERIFIED' | 'REJECTED' | 'PENDING' | 'MANUAL'

export interface SlipVerifyInput {
  fileBuffer: Buffer
  fileMime: string
  expectedAmountSatang: number
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
  provider: 'easyslip' | 'manual'
  fileSha256: string
  parsed: SlipVerifyParsed
  rawResponse?: unknown
}

export function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function isEnabled(): boolean {
  return (
    process.env.EASYSLIP_ENABLED === 'true' &&
    !!process.env.EASYSLIP_API_KEY
  )
}

/**
 * EasySlip response shape (simplified):
 * {
 *   status: 200,
 *   data: {
 *     transRef: string,
 *     date: string (ISO),
 *     amount: { amount: number, local: { amount: number, currency: "THB" } },
 *     sender: {
 *       bank: { id, name, short },
 *       account: { name: { th, en }, bank?: { type, account }, promptpay?: { type, account } }
 *     },
 *     receiver: {
 *       bank: { id, name, short },
 *       account: { name: { th, en }, bank?: { type, account }, promptpay?: { type, account } }
 *     }
 *   }
 * }
 */
interface EasySlipBank {
  id?: string
  name?: string
  short?: string
}
interface EasySlipAccountDetail {
  type?: string
  account?: string
}
interface EasySlipParty {
  bank?: EasySlipBank
  account?: {
    name?: { th?: string; en?: string }
    bank?: EasySlipAccountDetail
    promptpay?: EasySlipAccountDetail
  }
}
interface EasySlipData {
  transRef?: string
  date?: string
  amount?: { amount?: number; local?: { amount?: number; currency?: string } }
  sender?: EasySlipParty
  receiver?: EasySlipParty
}
interface EasySlipResponse {
  status?: number
  message?: string
  data?: EasySlipData
}

function parseEasySlipData(raw: unknown): SlipVerifyParsed {
  const res = raw as EasySlipResponse | null
  const data = res?.data
  if (!data) return {}

  // Amount in baht (e.g. 599.00) → satang integer (59900)
  const amountBaht = data.amount?.local?.amount ?? data.amount?.amount
  const amountSatang =
    typeof amountBaht === 'number' && Number.isFinite(amountBaht)
      ? Math.round(amountBaht * 100)
      : null

  let transferAt: Date | null = null
  if (typeof data.date === 'string') {
    const d = new Date(data.date)
    transferAt = isNaN(d.getTime()) ? null : d
  }

  const sender = data.sender
  const receiver = data.receiver

  const senderAccount =
    sender?.account?.bank?.account ?? sender?.account?.promptpay?.account ?? null
  const receiverAccount =
    receiver?.account?.bank?.account ?? receiver?.account?.promptpay?.account ?? null

  return {
    amountSatang,
    senderBank: sender?.bank?.short ?? sender?.bank?.name ?? null,
    senderName: sender?.account?.name?.th ?? sender?.account?.name?.en ?? null,
    senderAccount,
    receiverBank: receiver?.bank?.short ?? receiver?.bank?.name ?? null,
    receiverName: receiver?.account?.name?.th ?? receiver?.account?.name?.en ?? null,
    receiverAccount,
    transferAt,
    providerRef: data.transRef ?? null,
  }
}

/**
 * Call EasySlip with the uploaded file. Never throws on API failures — returns
 * MANUAL status so admin can fall back to eyeball review.
 */
export async function verifySlip(input: SlipVerifyInput): Promise<SlipVerifyResult> {
  const fileSha256 = sha256(input.fileBuffer)

  if (!isEnabled()) {
    return {
      status: 'MANUAL',
      errorMessage: 'EasySlip disabled — falling back to manual review',
      provider: 'manual',
      fileSha256,
      parsed: {},
    }
  }

  const apiKey = process.env.EASYSLIP_API_KEY!
  const url = 'https://developer.easyslip.app/api/verify-slip/qr-image/info'

  try {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(input.fileBuffer)], { type: input.fileMime })
    form.append('file', blob, 'slip')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: apiKey },
        body: form,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const json: unknown = await res.json().catch(() => null)
    const easyRes = json as EasySlipResponse | null

    if (!res.ok || (easyRes?.status && easyRes.status !== 200)) {
      const msg = easyRes?.message ?? `EasySlip HTTP ${res.status}`
      return {
        status: 'REJECTED',
        errorMessage: msg,
        provider: 'easyslip',
        fileSha256,
        parsed: {},
        rawResponse: json,
      }
    }

    const parsed = parseEasySlipData(json)

    // Amount must match exactly (satang).
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
        provider: 'easyslip',
        fileSha256,
        parsed,
        rawResponse: json,
      }
    }

    // Receiver check (optional)
    const expectedReceiver = process.env.EASYSLIP_EXPECTED_RECEIVER
    if (expectedReceiver && parsed.receiverAccount) {
      const normalizedReceiver = parsed.receiverAccount.replace(/[^0-9Xx*]/g, '')
      const normalizedExpected = expectedReceiver.replace(/[^0-9]/g, '')
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
          provider: 'easyslip',
          fileSha256,
          parsed,
          rawResponse: json,
        }
      }
    }

    return {
      status: 'VERIFIED',
      errorMessage: null,
      provider: 'easyslip',
      fileSha256,
      parsed,
      rawResponse: json,
    }
  } catch (e) {
    return {
      status: 'MANUAL',
      errorMessage: `EasySlip call failed — manual review required: ${e instanceof Error ? e.message : String(e)}`,
      provider: 'manual',
      fileSha256,
      parsed: {},
    }
  }
}
