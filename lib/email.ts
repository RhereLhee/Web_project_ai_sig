// lib/email.ts
// Email Service - รองรับ SMTP/Gmail, Resend, SendGrid
import { withRetry } from '@/lib/retry'

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
  const { randomInt } = require('crypto')
  return randomInt(100000, 999999).toString()
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
  console.log('═════════════════════════════════════════')
  console.log('MOCK EMAIL')
  console.log(`To: ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(`Body: ${html.replace(/<[^>]*>/g, '').substring(0, 200)}...`)
  console.log('═════════════════════════════════════════')
  
  return { success: true, messageId: `mock-${Date.now()}` }
}

// ============================================
// MAIN SEND FUNCTION
// ============================================

export async function sendEmail(to: string, subject: string, html: string): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || 'MOCK').toUpperCase() as EmailProvider

  // Mock ไม่ต้อง retry
  if (provider === 'MOCK') {
    return sendViaMock(to, subject, html)
  }

  // External API — ใช้ retry เพื่อป้องกัน API สะดุด
  return withRetry(async () => {
    let result: SendEmailResult

    switch (provider) {
      case 'SMTP':
        result = await sendViaSMTP(to, subject, html)
        break
      case 'RESEND':
        result = await sendViaResend(to, subject, html)
        break
      default:
        result = await sendViaMock(to, subject, html)
    }

    if (!result.success) {
      throw new Error(result.error || 'Email send failed')
    }
    return result
  }, { context: 'email', maxRetries: 2, delayMs: 1000 }).catch(() => {
    return { success: false, error: `Email ส่งไม่สำเร็จหลังจาก retry (${provider})` } as SendEmailResult
  })
}

// ============================================
// EMAIL OTP
// ============================================

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

// ============================================
// WITHDRAWAL EMAILS
// ============================================

interface WithdrawalEmailData {
  amount: number // บาท
  bankCode: string
  accountNumber: string
  accountName: string
  date: Date
  paymentRef?: string
}

/**
 * ส่ง Email แจ้งโอนเงินเรียบร้อยแล้ว
 */
export async function sendWithdrawalPaidEmail(
  email: string, 
  data: WithdrawalEmailData
): Promise<SendEmailResult> {
  const formattedDate = new Date(data.date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

      <div style="padding: 30px; background: #f9fafb;">
        
        <p style="color: #4b5563;">เรียน ลูกค้าที่เคารพ</p>
        
        <p style="color: #4b5563;">
          ทางทีมงานขอแจ้งให้ทราบว่า คำขอถอนเงินของท่านได้ดำเนินการโอนเงินเรียบร้อยแล้ว
        </p>
        
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #111827; margin-top: 0;">รายละเอียดการโอนเงิน</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">จำนวนเงิน:</td>
              <td style="padding: 8px 0; color: #10b981; font-weight: bold; text-align: right;">฿${data.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">ธนาคาร:</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${data.bankCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">เลขบัญชี:</td>
              <td style="padding: 8px 0; color: #111827; font-family: monospace; text-align: right;">${data.accountNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">ชื่อบัญชี:</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${data.accountName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">วันที่โอน:</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${formattedDate}</td>
            </tr>
            ${data.paymentRef ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">เลขอ้างอิง:</td>
              <td style="padding: 8px 0; color: #111827; font-family: monospace; text-align: right;">${data.paymentRef}</td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        <p style="color: #4b5563;">
          หากท่านมีข้อสงสัยเพิ่มเติม สามารถติดต่อทีมงานได้ผ่านช่องทางที่กำหนดไว้ ทีมงานยินดีให้บริการ
        </p>
        
        <p style="color: #4b5563;">
          ขอขอบคุณที่ไว้วางใจใช้บริการของเรา
        </p>
        
        <p style="color: #6b7280; margin-top: 30px;">
          ขอแสดงความนับถือ<br>
          <strong>ทีมงาน TechTrade</strong>
        </p>
      </div>
      <div style="background: #111827; padding: 20px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          อีเมลนี้ถูกส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
      </div>
    </div>
  `

  return sendEmail(email, 'แจ้งผลการอนุมัติคำขอถอนเงิน - TechTrade', html)
}

/**
 * แจ้งเจ้าของระบบเมื่อมีลูกค้าส่งสลิป (โดยเฉพาะ fallback PENDING/MANUAL)
 */
export async function sendSlipSubmittedAlert(data: {
  adminEmail: string
  orderNumber: string
  userId: string
  slipUrl: string
  verificationStatus: string
  amountSatang?: number | null
  senderBank?: string | null
  senderName?: string | null
}): Promise<SendEmailResult> {
  const appName = process.env.NEXT_PUBLIC_SITE_NAME || 'TechTrade'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const statusLabel =
    data.verificationStatus === 'VERIFIED'
      ? '✅ VERIFIED (SlipOK ยืนยันแล้ว รอ Admin กด Approve)'
      : data.verificationStatus === 'REJECTED'
        ? '❌ REJECTED (SlipOK ปฏิเสธ แต่ Admin ยังตรวจสอบได้)'
        : '⏳ PENDING (SlipOK ไม่ตอบ — Admin ต้องตรวจสอบเอง)'

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #059669; padding: 20px; text-align: center;">
        <h2 style="color: white; margin: 0;">${appName} — มีลูกค้าส่งสลิปใหม่</h2>
      </div>
      <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 140px;">Order Number:</td>
            <td style="padding: 8px 0; font-weight: bold; font-family: monospace;">${data.orderNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">User ID:</td>
            <td style="padding: 8px 0; font-family: monospace;">${data.userId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">สถานะสลิป:</td>
            <td style="padding: 8px 0;">${statusLabel}</td>
          </tr>
          ${data.amountSatang != null ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">ยอดในสลิป:</td>
            <td style="padding: 8px 0; font-weight: bold;">฿${(data.amountSatang / 100).toFixed(2)}</td>
          </tr>
          ` : ''}
          ${data.senderName ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">ชื่อผู้โอน:</td>
            <td style="padding: 8px 0;">${data.senderName}</td>
          </tr>
          ` : ''}
          ${data.senderBank ? `
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">ธนาคารผู้โอน:</td>
            <td style="padding: 8px 0;">${data.senderBank}</td>
          </tr>
          ` : ''}
        </table>
        ${appUrl ? `
        <div style="margin-top: 20px; text-align: center;">
          <a href="${appUrl}/admin/orders" style="display: inline-block; padding: 10px 24px; background: #059669; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
            ไปที่หน้า Admin Orders
          </a>
        </div>
        ` : ''}
      </div>
      <div style="background: #111827; padding: 12px; text-align: center;">
        <p style="color: #6b7280; font-size: 11px; margin: 0;">แจ้งเตือนอัตโนมัติจาก ${appName} System Monitor</p>
      </div>
    </div>
  `

  return sendEmail(data.adminEmail, `[${appName}] สลิปใหม่ — ${data.orderNumber} (${data.verificationStatus})`, html)
}

/**
 * ส่ง Email แจ้งปฏิเสธคำขอถอนเงิน
 */
export async function sendWithdrawalRejectedEmail(
  email: string,
  data: WithdrawalEmailData & { reason: string }
): Promise<SendEmailResult> {
  const formattedDate = new Date(data.date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">

      <div style="padding: 30px; background: #f9fafb;">
        <h2 style="color: #111827;">แจ้งผลคำขอถอนเงิน</h2>
        
        <p style="color: #4b5563;">เรียน ลูกค้าที่เคารพ</p>
        
        <p style="color: #4b5563;">
          ทางทีมงานขอแจ้งให้ทราบว่า คำขอถอนเงินของท่านยังไม่สามารถดำเนินการได้ในขณะนี้ หลังจากการตรวจสอบตามเงื่อนไขของระบบ
        </p>
         <p style="color: #4b5563;">
          เหตุผลในการปฏิเสธคำขอถอนเงิน: ${data.reason}
        </p>

        
        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="color: #111827; margin-top: 0;">รายละเอียดคำขอ</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">จำนวนเงิน:</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">฿${data.amount.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">ธนาคาร:</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${data.bankCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">เลขบัญชี:</td>
              <td style="padding: 8px 0; color: #111827; font-family: monospace; text-align: right;">${data.accountNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">วันที่ขอถอน:</td>
              <td style="padding: 8px 0; color: #111827; text-align: right;">${formattedDate}</td>
            </tr>
          </table>
        </div>
        
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 15px; margin: 20px 0;">
          <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>หมายเหตุ:</strong> ยอดเงินของท่านได้ถูกคืนกลับไปยังบัญชีเรียบร้อยแล้ว ท่านสามารถตรวจสอบและแก้ไขข้อมูลให้ถูกต้องครบถ้วน จากนั้นทำรายการขอถอนเงินใหม่ได้อีกครั้ง
          </p>
        </div>
        
        <p style="color: #4b5563;">
          หากมีข้อสงสัยเพิ่มเติม หรือประสงค์สอบถามรายละเอียดเกี่ยวกับเงื่อนไขการถอนเงิน กรุณาติดต่อทีมงานผ่านช่องทางที่กำหนด ทีมงานยินดีให้ความช่วยเหลืออย่างเต็มที่
        </p>
        
        <p style="color: #4b5563;">
          ขอขอบคุณที่ให้ความร่วมมือและไว้วางใจใช้บริการของเรา
        </p>
        
        <p style="color: #6b7280; margin-top: 30px;">
          ขอแสดงความนับถือ<br>
          <strong>ทีมงาน TechTrade</strong>
        </p>
      </div>
      <div style="background: #111827; padding: 20px; text-align: center;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          อีเมลนี้ถูกส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ
        </p>
      </div>
    </div>
  `

  return sendEmail(email, 'แจ้งผลคำขอถอนเงิน - TechTrade', html)
}