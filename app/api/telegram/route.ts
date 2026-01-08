import { NextResponse } from 'next/server'

interface TelegramMessage {
  message_id: number
  text?: string
  date: number
  from?: {
    id: number
    is_bot: boolean
    first_name: string
  }
  chat?: {
    id: number
    type: string
  }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  channel_post?: TelegramMessage
}

interface TelegramResponse {
  ok: boolean
  result: TelegramUpdate[]
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const channelUsername = process.env.TELEGRAM_CHANNEL_USERNAME || 'signal_techtrade'

    console.log('\n========================================')
    console.log('=== TELEGRAM API DEBUG ===')
    console.log('========================================')
    console.log('Bot Token:', botToken ? `✓ Present (${botToken.substring(0, 20)}...)` : '✗ Missing')
    console.log('Channel:', `@${channelUsername}`)
    console.log('Time:', new Date().toISOString())

    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    // Step 1: Get channel info
    console.log('\n--- Step 1: Get channel info ---')
    const chatInfoUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${channelUsername}`
    
    const chatResponse = await fetch(chatInfoUrl, {
      cache: 'no-store'
    })

    console.log('Chat API Status:', chatResponse.status)

    if (!chatResponse.ok) {
      const errorText = await chatResponse.text()
      console.error('❌ Channel not accessible')
      console.error('Error:', errorText)
      
      return NextResponse.json(
        { 
          error: 'Cannot access channel',
          details: errorText,
          channel: `@${channelUsername}`
        },
        { status: 403 }
      )
    }

    const chatData = await chatResponse.json()
    console.log('✓ Channel found:')
    console.log('  Title:', chatData.result?.title)
    console.log('  Type:', chatData.result?.type)
    console.log('  ID:', chatData.result?.id)
    console.log('  Username:', chatData.result?.username)

    // Step 2: Get updates
    console.log('\n--- Step 2: Get updates ---')
    const updatesUrl = `https://api.telegram.org/bot${botToken}/getUpdates?offset=-1&limit=100`
    console.log('Fetching from:', updatesUrl.replace(botToken, 'TOKEN'))
    console.log('Using offset=-1 to get latest updates')
    
    const response = await fetch(updatesUrl, {
      cache: 'no-store'
    })

    console.log('Updates API Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Updates API error:', errorText)
      throw new Error(`Telegram API error: ${response.status}`)
    }

    const data: TelegramResponse = await response.json()

    console.log('✓ Updates received:', data.result?.length || 0)

    // Step 3: Debug all updates
    console.log('\n--- Step 3: Inspect all updates ---')
    
    if (!data.result || data.result.length === 0) {
      console.log('⚠️  ZERO updates!')
      console.log('Possible reasons:')
      console.log('1. Bot has already processed all updates (offset issue)')
      console.log('2. No messages sent to bot yet')
      console.log('3. Bot is not receiving channel posts')
      
      // Try to get webhook info
      console.log('\n--- Checking webhook status ---')
      const webhookUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`
      const webhookResponse = await fetch(webhookUrl)
      const webhookData = await webhookResponse.json()
      console.log('Webhook:', webhookData.result?.url || 'Not set')
      
      return NextResponse.json({ 
        success: true,
        count: 0,
        signals: [],
        debug: {
          totalUpdates: 0,
          reason: 'No updates available',
          webhook: webhookData.result?.url || 'none',
          suggestion: 'Bot may have already processed updates. Try sending a new message.'
        }
      })
    }

    // Log first 5 updates in detail
    console.log(`\nInspecting ${Math.min(5, data.result.length)} updates:`)
    data.result.slice(0, 5).forEach((update, i) => {
      const msg = update.channel_post || update.message
      console.log(`\nUpdate ${i + 1}:`)
      console.log('  Update ID:', update.update_id)
      console.log('  Type:', update.channel_post ? 'channel_post' : update.message ? 'message' : 'other')
      console.log('  Message ID:', msg?.message_id)
      console.log('  Chat ID:', msg?.chat?.id)
      console.log('  Chat Type:', msg?.chat?.type)
      console.log('  Text:', msg?.text?.substring(0, 100))
      console.log('  Has TRADE keyword?', msg?.text?.includes('TRADE') ? '✓ YES' : '✗ NO')
      console.log('  Has WIN keyword?', msg?.text?.includes('WIN') ? '✓ YES' : '✗ NO')
      console.log('  Has LOSS keyword?', msg?.text?.includes('LOSS') ? '✓ YES' : '✗ NO')
    })

    // Step 4: Parse all messages
    console.log('\n--- Step 4: Parse messages ---')
    
    const allMessages = data.result
      .map((update) => update.channel_post || update.message)
      .filter((msg): msg is TelegramMessage => msg !== null)

    console.log('Total messages extracted:', allMessages.length)

    // Filter for signals
    const signalMessages = allMessages.filter((msg) => {
      if (!msg.text) return false
      const hasKeyword = msg.text.includes('TRADE') || msg.text.includes('WIN') || msg.text.includes('LOSS')
      return hasKeyword
    })

    console.log('Messages with TRADE/WIN/LOSS:', signalMessages.length)

    if (signalMessages.length > 0) {
      console.log('\n--- Found signal messages ---')
      signalMessages.slice(0, 3).forEach((msg, i) => {
        console.log(`\nSignal ${i + 1}:`)
        console.log('  Text:', msg.text)
      })
    }

    // Parse signals
    const signals = signalMessages
      .map((msg) => {
        const parsed = parseSignalMessage(msg)
        if (parsed) {
          console.log('✓ Parsed successfully:', parsed.pair, parsed.type, 'Level', parsed.level)
        } else {
          console.log('✗ Parse failed for:', msg.text?.substring(0, 50))
        }
        return parsed
      })
      .filter((signal) => signal !== null)
      .reverse() // Latest first
      .slice(0, 10) // Take latest 10

    console.log('\n--- Final Results ---')
    console.log('Total signals parsed:', signals.length)
    
    if (signals.length > 0) {
      console.log('Signals:', signals.map(s => `${s.pair} ${s.type}`).join(', '))
    }

    console.log('========================================\n')

    return NextResponse.json({ 
      success: true,
      count: signals.length,
      signals,
      debug: {
        totalUpdates: data.result.length,
        allMessages: allMessages.length,
        signalMessages: signalMessages.length,
        parsedSignals: signals.length
      }
    })
  } catch (error) {
    console.error('\n❌ FATAL ERROR ❌')
    console.error(error)
    console.error('========================================\n')
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch signals',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

function parseSignalMessage(msg: TelegramMessage) {
  if (!msg.text) return null

  try {
    const text = msg.text

    // Extract result (WIN/LOSS)
    const isWin = text.includes('WIN')
    const type = isWin ? 'WIN' : 'LOSS'

    // Extract level - "1 Level" or "2 Level"
    const levelMatch = text.match(/(\d+)\s*Level/)
    const level = levelMatch ? parseInt(levelMatch[1]) : 0

    // Extract pair - "Level - EURUSD" or "Level - GBPUSD"
    const pairMatch = text.match(/Level\s*-\s*([A-Z]{6,})/)
    const pair = pairMatch ? pairMatch[1] : 'UNKNOWN'

    // Extract time - "Time: 2026-01-07 09:05:00"
    const timeMatch = text.match(/Time:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/)
    let time = ''
    
    if (timeMatch) {
      const fullTime = timeMatch[1]
      const timeParts = fullTime.split(' ')[1]
      time = timeParts.substring(0, 5)
    } else {
      time = formatTime(msg.date)
    }

    return {
      id: msg.message_id,
      type,
      level,
      pair,
      time,
      text: msg.text,
    }
  } catch (error) {
    console.error('Parse error:', error)
    return null
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}