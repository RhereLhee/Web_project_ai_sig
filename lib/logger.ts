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
// THROTTLE + DEDUPLICATION
// 1 email per 5 min per (context+message) key
// Counts occurrences during the cooldown window
// ============================================
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000

interface CooldownEntry {
  lastSent: number
  pendingCount: number   // how many times this error fired since last email
}

const emailCooldowns = new Map<string, CooldownEntry>()

function getCooldownKey(context: string, message: string): string {
  // Group by context + first 80 chars of message (same error type)
  return `${context || 'system'}::${message.substring(0, 80)}`
}

/**
 * Returns { shouldSend: true, count } when cooldown expired (time to send email).
 * Returns { shouldSend: false } and increments counter when still in cooldown.
 */
function checkCooldown(context: string, message: string): { shouldSend: boolean; count: number } {
  const key = getCooldownKey(context, message)
  const entry = emailCooldowns.get(key)
  const now = Date.now()

  if (!entry || now - entry.lastSent >= EMAIL_COOLDOWN_MS) {
    // Cooldown expired or first occurrence — send email
    const count = entry ? entry.pendingCount + 1 : 1
    emailCooldowns.set(key, { lastSent: now, pendingCount: 0 })
    return { shouldSend: true, count }
  }

  // Still in cooldown — increment counter, don't send
  entry.pendingCount += 1
  return { shouldSend: false, count: 0 }
}

// ============================================
// LOGGER CLASS
// ============================================

class Logger {
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }

  /** Concise one-liner: first 300 chars of error.message, no stack trace */
  private truncateError(error: unknown, maxLen = 300): string {
    const msg = this.getErrorMessage(error)
    if (msg.length <= maxLen) return msg
    return msg.substring(0, maxLen) + '…'
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
      case 'fatal': {
        console.error(msg, entry.errorMessage || '', entry.metadata ? JSON.stringify(entry.metadata) : '')
        // แจ้ง Email ทันที (throttled + deduplicated)
        const { shouldSend, count } = checkCooldown(entry.context || 'system', entry.message)
        if (shouldSend) {
          this.notifyEmail(entry, count).catch(() => {})
        }
        break
      }
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
   * ส่ง Email แจ้งเตือน — กระชับ, ไม่ throw stack trace
   * count = จำนวนครั้งที่เกิด error เดียวกันในช่วง cooldown ที่ผ่านมา
   */
  private async notifyEmail(entry: LogEntry, count: number): Promise<void> {
    const alertEmail = process.env.ALERT_EMAIL
    if (!alertEmail) return

    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '587')
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS
    const fromEmail = process.env.EMAIL_FROM || user

    if (!host || !user || !pass) return

    const emoji = entry.level === 'fatal' ? '🔴' : '🟡'
    const appName = process.env.NEXT_PUBLIC_SITE_NAME || 'TechTrade'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    const countLabel = count > 1 ? ` (${count}x)` : ''
    const subject = `${emoji} [${appName}] ${entry.context || 'system'}: ${entry.message.substring(0, 60)}${countLabel}`

    // Concise error — first 300 chars only, no stack trace
    const shortError = entry.error ? this.truncateError(entry.error, 300) : null

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; font-size: 14px;">
        <div style="background: ${entry.level === 'fatal' ? '#dc2626' : '#f59e0b'}; padding: 14px 20px;">
          <strong style="color: white; font-size: 16px;">${emoji} ${appName} — ${entry.level.toUpperCase()}${countLabel}</strong>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; border-collapse: collapse; line-height: 1.8;">
            <tr>
              <td style="color: #6b7280; width: 110px; vertical-align: top;">Context</td>
              <td style="font-weight: bold;">${entry.context || 'system'}</td>
            </tr>
            <tr>
              <td style="color: #6b7280; vertical-align: top;">Message</td>
              <td>${entry.message}</td>
            </tr>
            ${shortError ? `
            <tr>
              <td style="color: #6b7280; vertical-align: top;">Error</td>
              <td style="color: #dc2626; font-family: monospace; font-size: 12px; word-break: break-word;">${shortError.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            </tr>
            ` : ''}
            ${count > 1 ? `
            <tr>
              <td style="color: #6b7280; vertical-align: top;">ซ้ำ</td>
              <td style="color: #f59e0b; font-weight: bold;">${count} ครั้งใน 5 นาทีที่ผ่านมา</td>
            </tr>
            ` : ''}
            ${entry.userId ? `
            <tr>
              <td style="color: #6b7280; vertical-align: top;">User</td>
              <td style="font-family: monospace; font-size: 12px;">${entry.userId}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="color: #6b7280; vertical-align: top;">เวลา</td>
              <td>${new Date(entry.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</td>
            </tr>
          </table>
          ${appUrl ? `
          <div style="margin-top: 16px;">
            <a href="${appUrl}/admin/logs" style="display: inline-block; padding: 8px 20px; background: #111827; color: white; text-decoration: none; border-radius: 6px; font-size: 13px;">
              ดู Logs เต็ม →
            </a>
          </div>
          ` : ''}
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
