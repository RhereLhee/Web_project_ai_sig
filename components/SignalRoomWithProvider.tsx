// components/SignalRoomWithProvider.tsx
"use client"

import { PipProvider } from "@/components/PipProvider"
import { SignalRoomContent } from "@/components/SignalRoomContent"

interface User {
  signalSubscription?: {
    endDate: Date
  }
}

export function SignalRoomWithProvider({ user }: { user: User }) {
  return (
    <PipProvider>
      <SignalRoomContent user={user} />
    </PipProvider>
  )
}
