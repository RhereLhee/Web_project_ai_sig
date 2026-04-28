"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"

const menuGroups = [
  {
    title: "ภาพรวม",
    items: [
      { href: "/admin", label: "Dashboard", exact: true },
      { href: "/admin/stats", label: "สถิติ" },
    ],
  },
  {
    title: "จัดการ",
    items: [
      { href: "/admin/users", label: "สมาชิก" },
      { href: "/admin/orders", label: "ออเดอร์" },
      { href: "/admin/withdrawals", label: "ถอนเงิน" },
    ],
  },
  {
    title: "Signal",
    items: [{ href: "/admin/signal-settings", label: "จัดการ Signal" }],
  },
  {
    title: "คอนเทนต์",
    items: [{ href: "/admin/courses", label: "คอร์ส" }],
  },
  {
    title: "ระบบ",
    items: [
      { href: "/admin/system", label: "System Controls" },
      { href: "/admin/settings", label: "ตั้งค่า 2FA" },
      { href: "/admin/logs", label: "System Logs" },
    ],
  },
]

function NavItems({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <nav className="flex-1 overflow-y-auto p-2">
      {menuGroups.map((group) => (
        <div key={group.title} className="mb-4">
          <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {group.title}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive(item.href, item.exact)
                  ? "bg-emerald-600 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

export function AdminSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    window.addEventListener("keydown", handleEsc)
    return () => window.removeEventListener("keydown", handleEsc)
  }, [])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-gray-900 text-white flex-col fixed h-full z-30">
        <div className="p-4 border-b border-gray-700">
          <Link href="/admin" className="text-xl font-bold text-emerald-400">
            Admin Panel
          </Link>
        </div>
        <NavItems />
        <div className="p-4 border-t border-gray-700">
          <Link href="/dashboard" className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm">
            <span>←</span>
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center px-4 h-14">
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          aria-label="เปิดเมนู"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="ml-3 font-bold text-emerald-400">Admin Panel</span>
      </header>

      {/* Mobile drawer */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col z-50 transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <Link href="/admin" className="text-xl font-bold text-emerald-400">
            Admin Panel
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="ปิดเมนู"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <NavItems onClose={() => setIsOpen(false)} />
        <div className="p-4 border-t border-gray-700">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm"
            onClick={() => setIsOpen(false)}
          >
            <span>←</span>
            <span>กลับหน้าหลัก</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
