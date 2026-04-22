// lib/logger.ts
// Structured Logger — Error Handling + Email Notification + In-Memory Log Store
// แนวคิดจาก n8n: ระบบต้อง "เอาอยู่" แม้วันที่มันพัง
// ดู log ผ่าน: GET /api/admin/logs
// แจ้งเตือน error/fatal ผ่าน Email (ไม่ใช่ Telegram)

type LogLevel = 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  level: LogLevel
  message: string
  context?: string      // เช่น 'auth', 'payment', 'withdrawal', 'signal', 'register'
  userId?: string
  error?: unknown
  errorMessage?: string  // serialized error message สำหรับ API response
  metadata?: Record<string, unknown>
  timestamp: string
}

// ============================================
// IN-MEMORY LOG STORE
// เก็บ log ล่าสุด 500 รายการ ดูผ่าน Admin API
// ============================================
const MAX_LOG_ENTRIES = 500

class LogStore {
  private entries: LogEntry[] = []

  add(entry: LogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries = this.entries.slice(-MAX_LOG_ENTRIES)
    }
  }

  getAll(options?: { level?: LogLevel; context?: string; limit?: number }): LogEntry[] {
    let result = [...this.entries]

    if (options?.level) {
      result = result.filter(e => e.level === options.level)
    }
    if (options?.context) {
      result = result.filter(e => e.context === options.context)
    }

    result.reverse()

    if (options?.limit) {
      result = result.slice(0, options.limit)
    }

    return result
  }

  getErrors(): LogEntry[] {
    return this.getAll({ level: 'error' })
  }

  getFatals(): LogEntry[] {
    return this.getAll({ level: 'fatal' })
  }

  getStats(): { total: number; byLevel: Record<string, number>; byContext: Record<string, number> } {
    const byLevel: Record<string, number> = {}
    const byContext: Record<string, number> = {}

    for (const entry of this.entries) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1
      if (entry.context) {
        byContext[entry.context] = (byContext[entry.context] || 0) + 1
      }
    }

    return { total: this.entries.length, byLevel, byContext }
  }

  clear(): void {
    this.entries = []
  }
}

export const logStore = new LogStore()

// ============================================
// THROTTLE — ป้องกันส่ง email ถี่เกินไป
// ส่งได้สูงสุด 1 ฉบับ ต่อ 5 นาที (ต่อ context)
// ============================================
const emailCooldowns = new Map<string, number>()
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000 // 5 นาที

function shouldSendEmail(context: string): boolean {
  const key = context || 'system'
  const lastSent = emailCooldowns.get(key) || 0
  if (Date.now() - lastSent < EMAIL_COOLDOWN_MS) return false
  emailCooldowns.set(key, Date.now())
  return true
}

// ============================================
// LOGGER CLASS
// ============================================

class Logger {
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.message}\n${error.stack || ''}`
    }
    return String(error)
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }

  private log(entry: LogEntry): void {
    if (entry.error) {
      entry.errorMessage = this.getErrorMessage(entry.error)
    }

    // เก็บลง memory store
    logStore.add({ ...entry, error: undefined, errorMessage: entry.errorMessage })

    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ''}`
    const msg = `${prefix} ${entry.message}`

    switch (entry.level) {
      case 'info':
        console.log(msg, entry.metadata ? JSON.stringify(entry.metadata) : '')
        break
      case 'warn':
        console.warn(msg, entry.metadata ? JSON.stringify(entry.metadata) : '')
        break
      case 'error':
      case 'fatal':
        console.error(msg, entry.error ? this.formatError(entry.error) : '', entry.metadata ? JSON.stringify(entry.metadata) : '')
        // แจ้ง Email ทันที เมื่อมี error/fatal (throttled)
        if (shouldSendEmail(entry.context || 'system')) {
          this.notifyEmail(entry).catch(() => {})
        }
        break
    }
  }

  info(message: string, ctx?: { context?: string; userId?: string; metadata?: Record<string, unknown> }): void {
    this.log({ level: 'info', message, timestamp: new Date().toISOString(), ...ctx })
  }

  warn(message: string, ctx?: { context?: string; userId?: string; error?: unknown; metadata?: Record<string, unknown> }): void {
    this.log({ level: 'warn', message, timestamp: new Date().toISOString(), ...ctx })
  }

  error(message: string, ctx?: { context?: string; userId?: string; error?: unknown; metadata?: Record<string, unknown> }): void {
    this.log({ level: 'error', message, timestamp: new Date().toISOString(), ...ctx })
  }

  fatal(message: string, ctx?: { context?: string; userId?: string; error?: unknown; metadata?: Record<string, unknown> }): void {
    this.log({ level: 'fatal', message, timestamp: new Date().toISOString(), ...ctx })
  }

  /**
   * แจ้ง Email ทันที — ส่งไปยัง ALERT_EMAIL ที่ตั้งค่าไว้ใน .env
   * ถ้าเว็บล่ม / payment error / withdrawal error จะได้รู้ทันที
   * Throttled: ส่งได้ 1 ฉบับต่อ context ทุก 5 นาที (ป้องกัน spam)
   */
  private async notifyEmail(entry: LogEntry): Promise<void> {
    const alertEmail = process.env.ALERT_EMAIL
    if (!alertEmail) return

    // ใช้ SMTP ตรง ๆ ไม่พึ่ง lib/email.ts (ป้องกัน circular dependency)
    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '587')
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const fromEmail = process.env.EMAIL_FROM || user

    if (!host || !user || !pass) return

    const emoji = entry.level === 'fatal' ? '' : ''
    const appName = process.env.NEXT_PUBLIC_SITE_NAME || 'TechTrade'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    const subject = `${emoji} [${appName}] ${entry.level.toUpperCase()} — ${entry.context || 'system'}: ${entry.message.substring(0, 80)}`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${entry.level === 'fatal' ? '#dc2626' : '#f59e0b'}; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">${emoji} ${appName} — ${entry.level.toUpperCase()}</h2>
        </div>
        <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 120px;">Context:</td>
              <td style="padding: 8px 0; font-weight: bold;">${entry.context || 'system'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Message:</td>
              <td style="padding: 8px 0;">${entry.message}</td>
            </tr>
            ${entry.errorMessage ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Error:</td>
              <td style="padding: 8px 0; color: #dc2626; font-family: monospace; font-size: 13px;">${entry.errorMessage}</td>
            </tr>
            ` : ''}
            ${entry.userId ? `
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">User ID:</td>
              <td style="padding: 8px 0; font-family: monospace;">${entry.userId}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Time:</td>
              <td style="padding: 8px 0;">${new Date(entry.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</td>
            </tr>
          </table>
          ${appUrl ? `
          <div style="margin-top: 20px; text-align: center;">
            <a href="${appUrl}/admin/logs" style="display: inline-block; padding: 10px 24px; background: #111827; color: white; text-decoration: none; border-radius: 6px;">
              ดู Logs ทั้งหมด
            </a>
          </div>
          ` : ''}
        </div>
        <div style="background: #111827; padding: 12px; text-align: center;">
          <p style="color: #6b7280; font-size: 11px; margin: 0;">
            แจ้งเตือนอัตโนมัติจาก ${appName} System Monitor
          </p>
        </div>
      </div>
    `

    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      })

      await transporter.sendMail({
        from: `"${appName} Alert" <${fromEmail}>`,
        to: alertEmail,
        subject,
        html,
      })
    } catch {
      // Silent fail — logger ไม่ควรทำให้ระบบพัง
    }
  }
}

export const logger = new Logger()
