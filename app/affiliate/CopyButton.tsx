"use client"

import { useState } from "react"

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const link = `${window.location.origin}/register?ref=${code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button 
      onClick={handleCopy} 
      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
    >
      {copied ? "✓" : "📋"}
    </button>
  )
}
