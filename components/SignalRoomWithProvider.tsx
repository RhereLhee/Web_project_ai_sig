// components/SignalRoomWithProvider.tsx
// PipProvider อยู่ใน layout.tsx แล้ว ไม่ต้องครอบซ้ำ
"use client"

import { SignalRoomContent } from "@/components/SignalRoomContent"

interface User {
  signalSubscription?: {
    endDate: Date
  }
}

export function SignalRoomWithProvider({ user }: { user: User }) {
  return <SignalRoomContent user={user} />
}
