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

    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token not configured' },
        { status: 500 }
      )
    }

    const chatInfoUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${channelUsername}`

    const chatResponse = await fetch(chatInfoUrl, {
      cache: 'no-store'
    })

    if (!chatResponse.ok) {
      return NextResponse.json(
        {
          error: 'Cannot access channel',
          channel: `@${channelUsername}`
        },
        { status: 403 }
      )
    }

    const updatesUrl = `https://api.telegram.org/bot${botToken}/getUpdates?offset=-1&limit=100`

    const response = await fetch(updatesUrl, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`)
    }

    const data: TelegramResponse = await response.json()

    if (!data.result || data.result.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        signals: [],
      })
    }

    const allMessages = data.result
      .map((update) => update.channel_post || update.message)
      .filter((msg): msg is TelegramMessage => msg !== null)

    const signalMessages = allMessages.filter((msg) => {
      if (!msg.text) return false
      return msg.text.includes('TRADE') || msg.text.includes('WIN') || msg.text.includes('LOSS')
    })

    const signals = signalMessages
      .map((msg) => parseSignalMessage(msg))
      .filter((signal) => signal !== null)
      .reverse()
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      count: signals.length,
      signals,
    })
  } catch (error) {
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

    const isWin = text.includes('WIN')
    const type = isWin ? 'WIN' : 'LOSS'

    const levelMatch = text.match(/(\d+)\s*Level/)
    const level = levelMatch ? parseInt(levelMatch[1]) : 0

    const pairMatch = text.match(/Level\s*-\s*([A-Z]{6,})/)
    const pair = pairMatch ? pairMatch[1] : 'UNKNOWN'

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
  } catch {
    return null
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}
