// lib/sms.ts
// SMS OTP Service - รองรับ ThaiBulkSMS, SMSMKT, Twilio

export type SMSProvider = 'THAIBULKSMS' | 'SMSMKT' | 'TWILIO' | 'MOCK'

interface SendSMSResult {
  success: boolean
  messageId?: string
  error?: string
}

// ============================================
// OTP GENERATION
// ============================================

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ============================================
// PHONE VALIDATION
// ============================================

export function isValidThaiPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^\d]/g, '')
  // 0812345678 หรือ 66812345678
  return /^(0[689]\d{8}|66[689]\d{8})$/.test(cleaned)
}

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d]/g, '')
  // แปลง 08x -> 668x
  if (cleaned.startsWith('0')) {
    cleaned = '66' + cleaned.substring(1)
  }
  return cleaned
}

// ============================================
// SMS PROVIDERS
// ============================================

async function sendViaThaiBulkSMS(phone: string, message: string): Promise<SendSMSResult> {
  const apiKey = process.env.THAIBULK_API_KEY
  const apiSecret = process.env.THAIBULK_API_SECRET
  const sender = process.env.THAIBULK_SENDER || 'TechTrade'

  if (!apiKey || !apiSecret) {
    return { success: false, error: 'ThaiBulkSMS not configured' }
  }

  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    
    const response = await fetch('https://bulk.thaibulksms.com/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({
        msisdn: phone,
        message: message,
        sender: sender,
      }),
    })

    const data = await response.json()

    if (response.ok && data.status === 'success') {
      return { success: true, messageId: data.uuid }
    }

    return { success: false, error: data.message || 'ThaiBulkSMS error' }
  } catch (error) {
    console.error('ThaiBulkSMS error:', error)
    return { success: false, error: 'Failed to send SMS' }
  }
}

async function sendViaSMSMKT(phone: string, message: string): Promise<SendSMSResult> {
  const apiKey = process.env.SMSMKT_API_KEY
  const apiSecret = process.env.SMSMKT_API_SECRET
  const sender = process.env.SMSMKT_SENDER || 'TechTrade'

  if (!apiKey || !apiSecret) {
    return { success: false, error: 'SMSMKT not configured' }
  }

  try {
    const response = await fetch('https://api.smsmkt.com/v2/sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        'secret-key': apiSecret,
      },
      body: JSON.stringify({
        sender: sender,
        phone: phone,
        message: message,
      }),
    })

    const data = await response.json()

    if (data.code === '0000') {
      return { success: true, messageId: data.result?.msgId }
    }

    return { success: false, error: data.message || 'SMSMKT error' }
  } catch (error) {
    console.error('SMSMKT error:', error)
    return { success: false, error: 'Failed to send SMS' }
  }
}

async function sendViaTwilio(phone: string, message: string): Promise<SendSMSResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio not configured' }
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          To: `+${phone}`,
          From: fromNumber,
          Body: message,
        }),
      }
    )

    const data = await response.json()

    if (response.ok) {
      return { success: true, messageId: data.sid }
    }

    return { success: false, error: data.message || 'Twilio error' }
  } catch (error) {
    console.error('Twilio error:', error)
    return { success: false, error: 'Failed to send SMS' }
  }
}

async function sendViaMock(phone: string, message: string): Promise<SendSMSResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📱 MOCK SMS')
  console.log(`📞 To: ${phone}`)
  console.log(`📝 Message: ${message}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  return { success: true, messageId: `mock-${Date.now()}` }
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

export async function sendSMS(phone: string, message: string): Promise<SendSMSResult> {
  const provider = (process.env.SMS_PROVIDER || 'MOCK').toUpperCase() as SMSProvider
  const formattedPhone = formatPhoneNumber(phone)

  switch (provider) {
    case 'THAIBULKSMS':
      return sendViaThaiBulkSMS(formattedPhone, message)
    case 'SMSMKT':
      return sendViaSMSMKT(formattedPhone, message)
    case 'TWILIO':
      return sendViaTwilio(formattedPhone, message)
    case 'MOCK':
    default:
      return sendViaMock(formattedPhone, message)
  }
}

export async function sendOTP(phone: string, otp: string): Promise<SendSMSResult> {
  const message = `รหัส OTP ของคุณคือ ${otp} (หมดอายุใน 5 นาที) - TechTrade`
  return sendSMS(phone, message)
}
