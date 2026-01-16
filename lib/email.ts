// lib/email.ts
// Email OTP Service - รองรับ SMTP/Gmail, Resend, SendGrid

export type EmailProvider = 'SMTP' | 'RESEND' | 'SENDGRID' | 'MOCK'

interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// ============================================
// OTP GENERATION
// ============================================

export function generateEmailOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ============================================
// EMAIL PROVIDERS
// ============================================

async function sendViaSMTP(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const fromEmail = process.env.EMAIL_FROM || user
  const fromName = process.env.EMAIL_FROM_NAME || 'TechTrade'

  if (!host || !user || !pass) {
    return { success: false, error: 'SMTP not configured' }
  }

  try {
    const nodemailer = await import('nodemailer')
    
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      html,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('SMTP error:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

async function sendViaResend(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'noreply@techtrade.io'
  const fromName = process.env.EMAIL_FROM_NAME || 'TechTrade'

  if (!apiKey) {
    return { success: false, error: 'Resend not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    })

    const data = await response.json()

    if (response.ok) {
      return { success: true, messageId: data.id }
    }

    return { success: false, error: data.message || 'Resend error' }
  } catch (error) {
    console.error('Resend error:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

async function sendViaMock(to: string, subject: string, html: string): Promise<SendEmailResult> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📧 MOCK EMAIL')
  console.log(`📬 To: ${to}`)
  console.log(`📝 Subject: ${subject}`)
  console.log(`📄 Body: ${html.replace(/<[^>]*>/g, '').substring(0, 200)}...`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  return { success: true, messageId: `mock-${Date.now()}` }
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || 'MOCK').toUpperCase() as EmailProvider

  switch (provider) {
    case 'SMTP':
      return sendViaSMTP(to, subject, html)
    case 'RESEND':
      return sendViaResend(to, subject, html)
    case 'MOCK':
    default:
      return sendViaMock(to, subject, html)
  }
}

export async function sendEmailOTP(email: string, otp: string): Promise<SendEmailResult> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">TechTrade</h1>
      </div>
      <div style="padding: 30px; background: #f9fafb;">
        <h2 style="color: #111827;">รหัสยืนยัน OTP</h2>
        <p style="color: #4b5563;">รหัส OTP ของคุณคือ:</p>
        <div style="background: #111827; color: #10b981; font-size: 32px; font-weight: bold; padding: 20px; text-align: center; border-radius: 8px; letter-spacing: 8px;">
          ${otp}
        </div>
        <p style="color: #6b7280; margin-top: 20px; font-size: 14px;">
          รหัสนี้จะหมดอายุใน 5 นาที<br>
          หากคุณไม่ได้ขอรหัสนี้ กรุณาเพิกเฉยอีเมลนี้
        </p>
      </div>
    </div>
  `

  return sendEmail(email, 'รหัส OTP ยืนยันตัวตน - TechTrade', html)
}
