// scripts/backup-now.ts
// Emergency backup — dump critical tables to JSON files.
// Run: npx tsx scripts/backup-now.ts

import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

const BACKUP_DIR = join(process.cwd(), 'backups', new Date().toISOString().slice(0, 10))

async function dump(name: string, query: () => Promise<unknown[]>) {
  const rows = await query()
  const path = join(BACKUP_DIR, `${name}.json`)
  writeFileSync(path, JSON.stringify(rows, null, 2))
  console.log(`  ${name}: ${rows.length} rows → ${path}`)
  return rows.length
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true })
  console.log(`Backup directory: ${BACKUP_DIR}\n`)

  let total = 0

  // Forward test data — 5 months, irreplaceable
  total += await dump('forward_sequence', () =>
    prisma.forwardSequence.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Users (without passwords)
  total += await dump('users', () =>
    prisma.user.findMany({
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        referralCode: true, referredById: true, phoneVerified: true,
        createdAt: true, lastLoginAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
  )

  // Orders
  total += await dump('orders', () =>
    prisma.order.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Signal subscriptions
  total += await dump('signal_subscriptions', () =>
    prisma.signalSubscription.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Partners
  total += await dump('partners', () =>
    prisma.partner.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Commissions
  total += await dump('commissions', () =>
    prisma.commission.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Affiliate payments
  total += await dump('affiliate_payments', () =>
    prisma.affiliatePayment.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Ledger entries (financial source of truth)
  total += await dump('ledger_entries', () =>
    prisma.ledgerEntry.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Withdrawals
  total += await dump('withdrawals', () =>
    prisma.withdrawal.findMany({ orderBy: { createdAt: 'asc' } }),
  )

  // Symbol configs
  total += await dump('symbol_configs', () =>
    prisma.symbolConfig.findMany(),
  )

  // System settings
  total += await dump('system_settings', () =>
    prisma.systemSetting.findMany(),
  )

  console.log(`\nTotal: ${total} rows backed up to ${BACKUP_DIR}`)
}

main()
  .catch((e) => {
    console.error('Backup failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
