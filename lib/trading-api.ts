// lib/trading-api.ts
// Functions สำหรับดึงข้อมูลจาก Trading API และ Database

import { prisma } from './prisma'

const SYMBOLS = ['AUDUSDm', 'EURUSDm', 'GBPUSDm', 'USDJPYm']

// ดึง Forward Test Stats จาก Supabase
export async function getForwardStats() {
  try {
    // ดึงข้อมูลจาก ForwardSequence
    const stats = await Promise.all(
      SYMBOLS.map(async (symbol) => {
        const sequences = await prisma.forwardSequence.findMany({
          where: { symbol },
        })

        const total = sequences.length
        const wins = sequences.filter(s => s.isWin).length
        const losses = total - wins

        // Win distribution by level
        const wonAtLevel1 = sequences.filter(s => s.wonAtLevel === 1).length
        const wonAtLevel2 = sequences.filter(s => s.wonAtLevel === 2).length
        const wonAtLevel3 = sequences.filter(s => s.wonAtLevel === 3).length

        return {
          symbol,
          total_sequences: total,
          winning_sequences: wins,
          losing_sequences: losses,
          win_rate: total > 0 ? (wins / total) * 100 : 0,
          won_at_level_1: wonAtLevel1,
          won_at_level_2: wonAtLevel2,
          won_at_level_3: wonAtLevel3,
        }
      })
    )

    return stats
  } catch (error) {
    console.error('Error fetching forward stats:', error)
    // Return empty stats
    return SYMBOLS.map(symbol => ({
      symbol,
      total_sequences: 0,
      winning_sequences: 0,
      losing_sequences: 0,
      win_rate: 0,
      won_at_level_1: 0,
      won_at_level_2: 0,
      won_at_level_3: 0,
    }))
  }
}

// ดึง Symbol Settings จาก Database
export async function getSymbolSettings() {
  try {
    const configs = await prisma.symbolConfig.findMany()

    return SYMBOLS.map(symbol => {
      const config = configs.find(c => c.symbol === symbol)
      return {
        symbol,
        enabled: config?.enabled ?? true,
        threshold: config?.threshold ?? 0.82,
        notes: config?.notes ?? null,
      }
    })
  } catch (error) {
    console.error('Error fetching symbol settings:', error)
    return SYMBOLS.map(symbol => ({
      symbol,
      enabled: true,
      threshold: 0.82,
      notes: null,
    }))
  }
}

// อัปเดต Symbol Setting
export async function updateSymbolSetting(
  symbol: string, 
  data: { enabled?: boolean; threshold?: number; notes?: string }
) {
  try {
    const config = await prisma.symbolConfig.upsert({
      where: { symbol },
      update: data,
      create: {
        symbol,
        enabled: data.enabled ?? true,
        threshold: data.threshold ?? 0.82,
        notes: data.notes,
      }
    })
    return { success: true, config }
  } catch (error) {
    console.error('Error updating symbol setting:', error)
    return { success: false, error: 'Failed to update' }
  }
}
