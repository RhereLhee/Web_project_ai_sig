// lib/logger.ts
// Structured Logger — Error Handling + Notification + In-Memory Log Store
// แนวคิดจาก n8n: ระบบต้อง "เอาอยู่" แม้วันที่มันพัง
// ดู log ผ่าน: GET /api/admin/logs

type LogLevel = 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  level: LogLevel
  message: string
  context?: string      // เช่น 'auth', 'payment', 'withdrawal', 'signal'
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
    // ลบ log เก่าถ้าเกินขีดจำกัด
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

    // เรียงล่าสุดก่อน
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
    // เก็บ serialized error message
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
        // แจ้ง Telegram ทันที เมื่อมี error/fatal
        this.notifyTelegram(entry).catch(() => {})
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
   * แจ้ง Telegram ทันที — ส่งตรงถึง Chat ID ที่ตั้งค่าไว้
   * ถ้าเว็บล่ม / payment error / withdrawal error จะได้รู้ทันที
   */
  private async notifyTelegram(entry: LogEntry): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID

    if (!botToken || !chatId) return

    const emoji = entry.level === 'fatal' ? '🚨' : '⚠️'
    const appName = process.env.NEXT_PUBLIC_SITE_NAME || 'TechTrade'
    const text = [
      `${emoji} *[${appName}] ${entry.level.toUpperCase()}*`,
      `📋 Context: ${entry.context || 'system'}`,
      `📝 ${entry.message}`,
      entry.error ? `❌ ${this.formatError(entry.error).substring(0, 500)}` : '',
      entry.userId ? `👤 User: ${entry.userId}` : '',
      `🕐 ${entry.timestamp}`,
    ].filter(Boolean).join('\n')

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      })
    } catch {
      // Silent fail — logger ไม่ควรทำให้ระบบพัง
    }
  }
}

export const logger = new Logger()
