// lib/slipok.ts
// EasySlip integration — OCR + bank verification for Thai transfer slips.
// https://document.easyslip.com/en/
//
// Env:
//   EASYSLIP_ENABLED           — "true" to call the API; otherwise returns MANUAL
//   EASYSLIP_API_KEY           — API key from EasySlip dashboard (UUID format)
//   EASYSLIP_EXPECTED_RECEIVER — (optional) account-number to verify receiver matches us

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

// EasySlip v2 response shape
interface EasySlipBank { id?: string; name?: string; code?: string }
interface EasySlipAccount {
  name?: { th?: string; en?: string }
  number?: string
}
interface EasySlipParty { bank?: EasySlipBank; account?: EasySlipAccount }
interface EasySlipRawSlip {
  transRef?: string
  date?: string
  amount?: { amount?: number }
  sender?: EasySlipParty
  receiver?: EasySlipParty
}
interface EasySlipResponse {
  success?: boolean
  message?: string
  data?: {
    isDuplicate?: boolean
    amountInSlip?: number
    rawSlip?: EasySlipRawSlip
  }
  error?: { code?: string; message?: string }
}

function parseEasySlipData(raw: unknown): SlipVerifyParsed {
  const res = raw as EasySlipResponse | null
  const slip = res?.data?.rawSlip
  if (!slip) return {}

  const amountBaht = slip.amount?.amount
  const amountSatang =
    typeof amountBaht === 'number' && Number.isFinite(amountBaht)
      ? Math.round(amountBaht * 100)
      : null

  let transferAt: Date | null = null
  if (typeof slip.date === 'string') {
    const d = new Date(slip.date)
    transferAt = isNaN(d.getTime()) ? null : d
  }

  return {
    amountSatang,
    senderBank: slip.sender?.bank?.name ?? slip.sender?.bank?.code ?? null,
    senderName: slip.sender?.account?.name?.th ?? slip.sender?.account?.name?.en ?? null,
    senderAccount: slip.sender?.account?.number ?? null,
    receiverBank: slip.receiver?.bank?.name ?? slip.receiver?.bank?.code ?? null,
    receiverName: slip.receiver?.account?.name?.th ?? slip.receiver?.account?.name?.en ?? null,
    receiverAccount: slip.receiver?.account?.number ?? null,
    transferAt,
    providerRef: slip.transRef ?? null,
  }
}

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

  try {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(input.fileBuffer)], { type: input.fileMime })
    form.append('image', blob, 'slip')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15_000)
    let res: Response
    try {
      res = await fetch('https://api.easyslip.com/v2/verify/bank', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const json: unknown = await res.json().catch(() => null)
    const easyRes = json as EasySlipResponse | null

    if (!res.ok || easyRes?.success === false) {
      const msg = easyRes?.error?.message ?? easyRes?.message ?? `EasySlip HTTP ${res.status}`
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

    const expectedReceiver = process.env.EASYSLIP_EXPECTED_RECEIVER
    if (expectedReceiver && parsed.receiverAccount) {
      const clean = (s: string) => s.replace(/[^0-9]/g, '')
      if (!clean(parsed.receiverAccount).includes(clean(expectedReceiver))) {
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
