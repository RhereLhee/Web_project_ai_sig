// app/api/signal/activate/route.ts
// Retired. This endpoint used to grant a free SignalSubscription (price=0) on
// any authenticated POST — a back-door that let logged-in users skip payment.
// The real purchase flow now goes through /api/checkout/signal -> PromptPay
// slip upload -> admin approval, which credits the subscription on PAID.
import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error: "เลิกใช้แล้ว — กรุณาซื้อผ่านขั้นตอน checkout (/api/checkout/signal)",
      code: "GONE",
    },
    { status: 410 },
  )
}
