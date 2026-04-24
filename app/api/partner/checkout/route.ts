// app/api/partner/checkout/route.ts
// Partner-purchase checkout is retired. Partner is now a free bank-info registration.
// Clients should POST /api/partner/register instead.
// Kept as a stub that returns 410 Gone so stale frontends fail loud instead of silent.
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Partner ไม่ใช่สินค้าแบบเสียเงินอีกต่อไป — กรุณาใช้ /api/partner/register เพื่อลงทะเบียนบัญชีธนาคารฟรี',
      code: 'GONE',
    },
    { status: 410 },
  )
}
