// lib/logger.ts
// Structured Logger — writes to PostgreSQL (SystemLog table)
// In-memory fallback buffer for the tiny window before DB is ready.
// Email notification for error/fatal with deduplication.

import { prisma } from './prisma'

type LogLevel = 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  level: LogLevel
  message: string
  context?: string
  userId?: string
  error?: unknown
  errorMessage?: string
  metadata?: Record<string, unknown>
  timestamp: string
}

// ============================================
// LEGACY IN-MEMORY STORE (kept for getStats())
// Holds only the current server session's logs
// so the API can compute stats without a full
// DB aggregation on every request.
// ============================================
class LogStore {
  private entries: LogEntry[] = []
  private readonly MAX = 1000

  add(entry: LogEntry): void {
    this.entries.push(entry)
    if (this.entries.length > this.MAX) this.entries.shift()
  }

  getAll(options?: { level?: LogLevel; context?: string; limit?: number }): LogEntry[] {
    let result = [...this.entries].reverse()
    if (options?.level) result = result.filter(e => e.level === options.level)
    if (options?.context) result = result.filter(e => e.context === options.context)
    if (options?.limit) result = result.slice(0, options.limit)
    return result
  }

  getStats(): { total: number; byLevel: Record<string, number>; byContext: Record<string, number> } {
    const byLevel: Record<string, number> = {}
    const byContext: Record<string, number> = {}
    for (const e of this.entries) {
      byLevel[e.level] = (byLevel[e.level] || 0) + 1
      if (e.context) byContext[e.context] = (byContext[e.context] || 0) + 1
    }
    return { total: this.entries.length, byLevel, byContext }
  }

  clear(): void { this.entries = [] }
}

export const logStore = new LogStore()

// ============================================
// THROTTLE + DEDUPLICATION
// 1 email per 5 min per (context+message) key
// ============================================
const EMAIL_COOLDOWN_MS = 5 * 60 * 1000

interface CooldownEntry { lastSent: number; pendingCount: number }
const emailCooldowns = new Map<string, CooldownEntry>()

function checkCooldown(context: string, message: string): { shouldSend: boolean; count: number } {
  const key = `${context || 'system'}::${message.substring(0, 80)}`
  const entry = emailCooldowns.get(key)
  const now = Date.now()
  if (!entry || now - entry.lastSent >= EMAIL_COOLDOWN_MS) {
    const count = entry ? entry.pendingCount + 1 : 1
    emailCooldowns.set(key, { lastSent: now, pendingCount: 0 })
    return { shouldSend: true, count }
  }
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

  private truncateError(error: unknown, maxLen = 300): string {
    const msg = this.getErrorMessage(error)
    return msg.length <= maxLen ? msg : msg.substring(0, maxLen) + '…'
  }

  private log(entry: LogEntry): void {
    if (entry.error) {
      entry.errorMessage = this.getErrorMessage(entry.error)
    }

    // 1. In-memory (for fast stats + session view)
    logStore.add({ ...entry, error: undefined })

    // 2. Console
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ''}`
    if (entry.level === 'error' || entry.level === 'fatal') {
      console.error(prefix, entry.message, entry.errorMessage || '', entry.metadata ? JSON.stringify(entry.metadata) : '')
    } else if (entry.level === 'warn') {
      console.warn(prefix, entry.message)
    } else {
      console.log(prefix, entry.message)
    }

    // 3. Persist to DB (fire-and-forget — never throws)
    this.persistToDB(entry).catch(() => {})

    // 4. Email alert for error/fatal
    if (entry.level === 'error' || entry.level === 'fatal') {
      const { shouldSend, count } = checkCooldown(entry.context || 'system', entry.message)
      if (shouldSend) this.notifyEmail(entry, count).catch(() => {})
    }
  }

  private async persistToDB(entry: LogEntry): Promise<void> {
    try {
      await prisma.systemLog.create({
        data: {
          level: entry.level,
          message: entry.message,
          context: entry.context ?? null,
          userId: entry.userId ?? null,
          errorMessage: entry.errorMessage ?? null,
          metadata: entry.metadata ? (entry.metadata as object) : undefined,
          timestamp: new Date(entry.timestamp),
        },
      })

      // Purge entries older than 90 days (async, low priority)
      // Run probabilistically (1 in 100) to avoid hammering DB on every log
      if (Math.random() < 0.01) {
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        await prisma.systemLog.deleteMany({ where: { timestamp: { lt: cutoff } } })
      }
    } catch {
      // DB write failure is silent — console already has the log
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
    const shortError = entry.error ? this.truncateError(entry.error, 300) : null

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; font-size: 14px;">
        <div style="background: ${entry.level === 'fatal' ? '#dc2626' : '#f59e0b'}; padding: 14px 20px;">
          <strong style="color: white; font-size: 16px;">${emoji} ${appName} — ${entry.level.toUpperCase()}${countLabel}</strong>
        </div>
        <div style="padding: 20px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; border-collapse: collapse; line-height: 1.8;">
            <tr><td style="color:#6b7280;width:110px;">Context</td><td style="font-weight:bold;">${entry.context || 'system'}</td></tr>
            <tr><td style="color:#6b7280;">Message</td><td>${entry.message}</td></tr>
            ${shortError ? `<tr><td style="color:#6b7280;vertical-align:top;">Error</td><td style="color:#dc2626;font-family:monospace;font-size:12px;word-break:break-word;">${shortError.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>` : ''}
            ${count > 1 ? `<tr><td style="color:#6b7280;">ซ้ำ</td><td style="color:#f59e0b;font-weight:bold;">${count} ครั้งใน 5 นาทีที่ผ่านมา</td></tr>` : ''}
            ${entry.userId ? `<tr><td style="color:#6b7280;">User</td><td style="font-family:monospace;font-size:12px;">${entry.userId}</td></tr>` : ''}
            <tr><td style="color:#6b7280;">เวลา</td><td>${new Date(entry.timestamp).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</td></tr>
          </table>
          ${appUrl ? `<div style="margin-top:16px;"><a href="${appUrl}/admin/logs" style="display:inline-block;padding:8px 20px;background:#111827;color:white;text-decoration:none;border-radius:6px;font-size:13px;">ดู Logs เต็ม →</a></div>` : ''}
        </div>
      </div>
    `

    try {
      const nodemailer = await import('nodemailer')
      const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
      await transporter.sendMail({ from: `"${appName} Alert" <${fromEmail}>`, to: alertEmail, subject, html })
    } catch {
      // Silent
    }
  }
}

export const logger = new Logger()
