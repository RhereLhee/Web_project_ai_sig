// lib/forward-test.ts
// ดึงข้อมูล Forward Test จาก Supabase (ผ่าน Prisma)

import { prisma } from './prisma'

export interface ForwardStats {
  symbol: string
  totalSequences: number
  winningSequences: number
  losingSequences: number
  winRate: number
  totalProfit: number
  wonAtLevel1: number
  wonAtLevel2: number
  wonAtLevel3: number
}

export interface PeriodStats {
  winRate: number
  totalSequences: number
}

// ============================================
// GET OVERALL STATS
// ============================================

export async function getOverallStats() {
  try {
    const sequences = await prisma.forwardSequence.findMany()
    
    const total = sequences.length
    const wins = sequences.filter(s => s.isWin).length
    const losses = total - wins
    const winRate = total > 0 ? (wins / total * 100) : 0
    const totalProfit = sequences.reduce((sum, s) => sum + s.totalProfit, 0)
    
    // Win distribution
    const wonAtLevel1 = sequences.filter(s => s.wonAtLevel === 1).length
    const wonAtLevel2 = sequences.filter(s => s.wonAtLevel === 2).length
    const wonAtLevel3 = sequences.filter(s => s.wonAtLevel === 3).length
    
    return {
      totalSequences: total,
      winningSequences: wins,
      losingSequences: losses,
      winRate: Math.round(winRate * 10) / 10,
      totalProfit: Math.round(totalProfit * 100) / 100,
      wonAtLevel1,
      wonAtLevel2,
      wonAtLevel3,
    }
  } catch (error) {
    console.error('Error fetching overall stats:', error)
    return null
  }
}

// ============================================
// GET STATS BY PERIOD (3 days, 7 days)
// ============================================

export async function getStatsByPeriod(days: number): Promise<PeriodStats> {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const sequences = await prisma.forwardSequence.findMany({
      where: {
        entryTime: { gte: startDate }
      }
    })
    
    const total = sequences.length
    const wins = sequences.filter(s => s.isWin).length
    const winRate = total > 0 ? (wins / total * 100) : 0
    
    return {
      winRate: Math.round(winRate * 10) / 10,
      totalSequences: total,
    }
  } catch (error) {
    console.error('Error fetching period stats:', error)
    return { winRate: 0, totalSequences: 0 }
  }
}

// ============================================
// GET STATS BY SYMBOL
// ============================================

export async function getStatsBySymbol(): Promise<ForwardStats[]> {
  try {
    const sequences = await prisma.forwardSequence.findMany()
    
    // Group by symbol
    const symbolMap: Record<string, typeof sequences> = {}
    
    for (const seq of sequences) {
      if (!symbolMap[seq.symbol]) {
        symbolMap[seq.symbol] = []
      }
      symbolMap[seq.symbol].push(seq)
    }
    
    // Calculate stats per symbol
    const stats: ForwardStats[] = []
    
    for (const [symbol, seqs] of Object.entries(symbolMap)) {
      const total = seqs.length
      const wins = seqs.filter(s => s.isWin).length
      const losses = total - wins
      const winRate = total > 0 ? (wins / total * 100) : 0
      const totalProfit = seqs.reduce((sum, s) => sum + s.totalProfit, 0)
      
      const wonAtLevel1 = seqs.filter(s => s.wonAtLevel === 1).length
      const wonAtLevel2 = seqs.filter(s => s.wonAtLevel === 2).length
      const wonAtLevel3 = seqs.filter(s => s.wonAtLevel === 3).length
      
      stats.push({
        symbol,
        totalSequences: total,
        winningSequences: wins,
        losingSequences: losses,
        winRate: Math.round(winRate * 10) / 10,
        totalProfit: Math.round(totalProfit * 100) / 100,
        wonAtLevel1,
        wonAtLevel2,
        wonAtLevel3,
      })
    }
    
    // Sort by symbol name
    return stats.sort((a, b) => a.symbol.localeCompare(b.symbol))
  } catch (error) {
    console.error('Error fetching symbol stats:', error)
    return []
  }
}

// ============================================
// GET RECENT LOSSES
// ============================================

export async function getRecentLosses(limit: number = 20) {
  try {
    const losses = await prisma.forwardSequence.findMany({
      where: { isWin: false },
      orderBy: { entryTime: 'desc' },
      take: limit,
    })
    
    return losses.map(l => ({
      id: l.id,
      symbol: l.symbol,
      signalType: l.signalType,
      entryTime: l.entryTime.toISOString(),
      tradesUsed: l.tradesUsed,
      totalProfit: l.totalProfit,
    }))
  } catch (error) {
    console.error('Error fetching recent losses:', error)
    return []
  }
}

// ============================================
// GET LAST SYNC TIME
// ============================================

export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const latest = await prisma.forwardSequence.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    })
    
    return latest?.createdAt || null
  } catch (error) {
    console.error('Error fetching last sync time:', error)
    return null
  }
}
