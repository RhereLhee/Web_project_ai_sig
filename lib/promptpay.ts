// lib/promptpay.ts
// PromptPay QR Code Generator

import QRCode from 'qrcode'

// ============================================
// CONFIG
// ============================================

export const PROMPTPAY_CONFIG = {
  id: process.env.PROMPTPAY_ID || '0652479602',
  name: process.env.PROMPTPAY_NAME || 'TechTrade',
}

// ============================================
// GENERATE PROMPTPAY PAYLOAD
// ============================================

/**
 * สร้าง PromptPay Payload ตาม EMVCo Standard
 * @param mobileNumber - เบอร์โทร PromptPay (10 หลัก)
 * @param options - { amount?: number }
 */
export function generatePayload(
  mobileNumber: string,
  options: { amount?: number } = {}
): string {
  // Sanitize mobile number
  const sanitized = sanitizeTarget(mobileNumber)
  
  // Format for PromptPay: 0066 + 9 digits (drop leading 0)
  const formattedMobile = '0066' + sanitized.slice(1)
  
  // Build payload
  const payload = [
    formatField('00', '01'), // Payload Format Indicator
    formatField('01', options.amount ? '12' : '11'), // Static or Dynamic QR
    formatMerchantAccount(formattedMobile),
    formatField('53', '764'), // Currency (THB)
    options.amount ? formatField('54', options.amount.toFixed(2)) : '',
    formatField('58', 'TH'), // Country
    formatField('62', formatField('05', 'ORDER')), // Additional Data
  ]
    .filter(Boolean)
    .join('')

  // Add checksum
  const crc = calculateCRC(payload + '6304')
  return payload + '6304' + crc
}

// ============================================
// GENERATE QR CODE IMAGE
// ============================================

/**
 * สร้าง QR Code เป็น Data URL (base64)
 */
export async function generateQRCode(payload: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
    return qrDataUrl
  } catch (error) {
    console.error('QR Code generation error:', error)
    throw new Error('Failed to generate QR Code')
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function sanitizeTarget(target: string): string {
  // Remove all non-digits
  const digits = target.replace(/\D/g, '')
  
  // Mobile number: should be 10 digits starting with 0
  if (digits.length === 10 && digits.startsWith('0')) {
    return digits
  }
  
  // National ID: should be 13 digits
  if (digits.length === 13) {
    return digits
  }
  
  throw new Error('Invalid PromptPay ID: must be 10-digit mobile or 13-digit national ID')
}

function formatField(id: string, value: string): string {
  const length = value.length.toString().padStart(2, '0')
  return id + length + value
}

function formatMerchantAccount(formattedMobile: string): string {
  const merchantData = [
    formatField('00', 'A000000677010111'), // PromptPay AID
    formatField('01', formattedMobile), // Mobile number
  ].join('')
  
  return formatField('29', merchantData)
}

function calculateCRC(payload: string): string {
  // CRC-16 CCITT (XModem)
  let crc = 0xffff
  
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc <<= 1
      }
      crc &= 0xffff
    }
  }
  
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// ============================================
// VERIFY QR DATA (for testing)
// ============================================

export function verifyPromptPayPayload(payload: string): boolean {
  if (payload.length < 8) return false
  
  const providedCrc = payload.slice(-4)
  const dataWithoutCrc = payload.slice(0, -4)
  const calculatedCrc = calculateCRC(dataWithoutCrc)
  
  return providedCrc === calculatedCrc
}
/**
 * สร้าง PromptPay QR Code เป็น Data URL
 * @param promptPayId - เบอร์โทร หรือ เลขบัตรประชาชน
 * @param amount - จำนวนเงิน (บาท)
 */
export async function generatePromptPayQR(
  promptPayId: string,
  amount: number
): Promise<string> {
  const payload = generatePayload(promptPayId, { amount })
  return await generateQRCode(payload)
}