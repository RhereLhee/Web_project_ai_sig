/**
 * External Links Configuration
 * 
 * Centralized configuration for all external links
 * Easy to maintain and update
 * Better security - encrypt sensitive links if needed
 */

export const SOCIAL_LINKS = {
  discord: process.env.NEXT_PUBLIC_DISCORD_URL || 'https://discord.gg/techtrade',
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/techtrade_stats',
  line: process.env.NEXT_PUBLIC_LINE_URL || 'https://line.me/ti/p/@techtrade',
  facebook: process.env.NEXT_PUBLIC_FACEBOOK_URL || 'https://facebook.com/techtrade',
} as const

export const YOUTUBE_VIDEO = {
  introVideo: process.env.NEXT_PUBLIC_YOUTUBE_INTRO || 'dQw4w9WgXcQ',
  dashboardVideo: process.env.NEXT_PUBLIC_YOUTUBE_DASHBOARD || 'dQw4w9WgXcQ',
} as const

export const PAYMENT_INFO = {
  promptpayId: process.env.NEXT_PUBLIC_PROMPTPAY_ID || '',
  bankName: process.env.NEXT_PUBLIC_BANK_NAME || '',
  accountNumber: process.env.NEXT_PUBLIC_ACCOUNT_NUMBER || '',
  accountName: process.env.NEXT_PUBLIC_ACCOUNT_NAME || '',
} as const

export const SITE_CONFIG = {
  siteName: 'TechTrade',
  supportEmail: 'support@techtrade.io',
  supportPhone: '02-XXX-XXXX',
} as const

// Helper function to get social link
export function getSocialLink(platform: keyof typeof SOCIAL_LINKS): string {
  return SOCIAL_LINKS[platform]
}

// Helper function to get YouTube embed URL
export function getYouTubeEmbedUrl(videoType: keyof typeof YOUTUBE_VIDEO): string {
  const videoId = YOUTUBE_VIDEO[videoType]
  return `https://www.youtube.com/embed/${videoId}`
}