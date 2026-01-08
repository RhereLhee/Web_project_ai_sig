// Types for TechTrade

export interface User {
  id: string
  name: string | null
  email: string | null
  image: string | null
  phone: string | null
  role: 'ADMIN' | 'SUBSCRIBER' | 'USER'
  referralCode: string
  referredById: string | null
  createdAt: Date
}

export interface Plan {
  id: string
  name: string
  slug: string
  basePrice: number
  discountPercent: number
  finalPrice: number
  durationMonths: number
  affiliatePool: number
  promoExtraMonths: number
  isActive: boolean
  isPopular: boolean
  features: string[]
}

export interface Subscription {
  id: string
  userId: string
  planId: string
  plan?: Plan
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PENDING'
  startDate: Date | null
  endDate: Date | null
  isFirstTime: boolean
}

export interface Order {
  id: string
  orderNumber: string
  subscriptionId: string
  userId: string
  originalAmount: number
  discountAmount: number
  affiliatePool: number
  finalAmount: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  paymentMethod: 'QR_CODE' | 'BANK_APP' | 'CREDIT_CARD' | null
  paidAt: Date | null
  createdAt: Date
}

export interface Signal {
  id: string
  symbol: string
  signalType: 'CALL' | 'PUT'
  entryTime: Date
  entryPrice: number
  exitTime: Date | null
  exitPrice: number | null
  status: 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  result: string | null
  profit: number | null
  level: number
  confidence: number | null
}

export interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail: string | null
  type: 'TRADING' | 'FINANCE'
  isPublished: boolean
  sections?: Section[]
}

export interface Section {
  id: string
  courseId: string
  title: string
  order: number
  videos?: Video[]
}

export interface Video {
  id: string
  sectionId: string
  title: string
  description: string | null
  url: string
  duration: number | null
  order: number
}

export interface UserProgress {
  id: string
  userId: string
  videoId: string
  progress: number
  completed: boolean
}

export interface Event {
  id: string
  title: string
  slug: string
  description: string | null
  type: 'SEMINAR' | 'WORKSHOP' | 'MEETUP' | 'ZOOM'
  startDate: Date
  endDate: Date | null
  location: string | null
  maxSeats: number | null
  currentSeats: number
  price: number
  freeForSubs: boolean
  isPublished: boolean
}

export interface Commission {
  id: string
  userId: string
  level: number
  amount: number
  amountBaht: number
  status: string
  createdAt: Date
}

export interface AffiliateStats {
  totalTeam: number
  directReferrals: number
  totalEarnings: number
  pendingEarnings: number
  thisMonth: number
}

export interface WalletInfo {
  balance: number
  pending: number
  totalEarned: number
}
