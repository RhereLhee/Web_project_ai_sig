"use client"

import { useState } from "react"

export function CopyButton({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/register?ref=${referralCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleCopy} className="btn btn-primary">
      {copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์"}
    </button>
  )
}
