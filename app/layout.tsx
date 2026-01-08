import type { Metadata } from 'next'
import './globals.css'  // ← globals.css อยู่ที่นี่

export const metadata: Metadata = {
  title: 'TechTrade',
  description: 'Algorithm Trade Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}