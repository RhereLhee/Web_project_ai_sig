// app/(main)/PipProviderWrapper.tsx
"use client"

import { PipProvider } from "@/components/PipProvider"
import { type ReactNode } from "react"

interface PipProviderWrapperProps {
  children: ReactNode
  hasSignal: boolean
}

export function PipProviderWrapper({ children, hasSignal }: PipProviderWrapperProps) {
  // Only wrap with PipProvider if user has signal access
  // This ensures WebSocket connection only happens when needed
  if (hasSignal) {
    return (
      <PipProvider>
        {children}
      </PipProvider>
    )
  }

  // No signal access - render children without provider
  return <>{children}</>
}