"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import Image from "next/image"
import { SITE_CONFIG } from "@/lib/config"
import { useState, useEffect } from "react"

interface SidebarProps {
  user: {
    name: string | null
    email: string | null
    role: string
  }
  hasPartner: boolean
  hasSignal: boolean
}

export function Sidebar({ user, hasPartner, hasSignal }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isCoursesOpen, setIsCoursesOpen] = useState(pathname.startsWith('/courses'))
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // ปิด sidebar เมื่อเปลี่ยนหน้า
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // ปิด sidebar เมื่อกด Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])

  // Lock body scroll เมื่อเปิด sidebar บน mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Logout handler
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/login')
    }
  }

  // Check if current path matches
  const isActivePath = (href: string) => {
    if (href === '/courses') {
      return pathname.startsWith('/courses')
    }
    return pathname === href
  }

  // Check if Admin
  const isAdmin = user.role === 'ADMIN'

  // Determine badge
  let badge = "Free"
  let badgeColor = "bg-gray-500"
  
  if (isAdmin) {
    badge = "Admin"
    badgeColor = "bg-red-500"
  } else if (hasSignal && hasPartner) {
    badge = "Partner + Signal"
    badgeColor = "bg-gradient-to-r from-purple-500 to-emerald-500"
  } else if (hasPartner) {
    badge = "Partner"
    badgeColor = "bg-purple-500"
  } else if (hasSignal) {
    badge = "Signal"
    badgeColor = "bg-emerald-500"
  }

  // Course submenu items
  const courseSubMenu = [
    { name: "Free Courses", href: "/courses?tab=free", icon: "🆓", locked: false },
    { name: "Pro Courses", href: "/courses?tab=pro", icon: "⭐", locked: !hasSignal && !isAdmin },
    { name: "Partner Courses", href: "/courses?tab=partner", icon: "🤝", locked: !hasPartner && !isAdmin },
  ]

  // Sidebar content (reusable)
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-4 md:p-6 flex justify-center">
        <Link href="/dashboard" className="w-full flex justify-center" onClick={() => setIsOpen(false)}>
          <Image
            src="/logo_wihtetext.png"
            alt={SITE_CONFIG.siteName}
            width={600}
            height={200}
            className="h-12 md:h-16 w-full object-contain px-2"
            priority
          />
        </Link>
      </div>

      {/* User Profile */}
      <div className="px-4 md:px-6 pb-4 md:pb-6">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
              isAdmin 
                ? 'bg-gradient-to-br from-red-500 to-orange-600' 
                : 'bg-gradient-to-br from-emerald-500 to-cyan-600'
            }`}>
              {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate text-sm md:text-base">{user.name || "User"}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold text-white ${badgeColor}`}>
            {badge}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 md:px-4 space-y-1 overflow-y-auto">
        {/* Admin Panel */}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => setIsOpen(false)}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              pathname.startsWith('/admin')
                ? "bg-red-600 text-white"
                : "text-red-400 hover:bg-red-900/50 hover:text-white"
            }`}
          >
            <span className="text-xl">🛡️</span>
            <span className="font-medium">Admin Panel</span>
          </Link>
        )}

        {/* หน้าหลัก */}
        <Link
          href="/dashboard"
          onClick={() => setIsOpen(false)}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            pathname === '/dashboard'
              ? "bg-emerald-600 text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <span className="text-xl">🏠</span>
          <span className="font-medium">หน้าหลัก</span>
        </Link>

        {/* Signal Room */}
        <Link
          href="/signals"
          onClick={() => setIsOpen(false)}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            pathname === '/signals'
              ? "bg-emerald-600 text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <span className="text-xl">📊</span>
          <span className="font-medium">Signal Room</span>
        </Link>

        {/* ห้องเรียน - with Dropdown */}
        <div>
          <button
            onClick={() => setIsCoursesOpen(!isCoursesOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
              isActivePath('/courses')
                ? "bg-emerald-600 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-3">
              <span className="text-xl">📚</span>
              <span className="font-medium">ห้องเรียน</span>
            </div>
            <svg 
              className={`w-4 h-4 transition-transform ${isCoursesOpen ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {isCoursesOpen && (
            <div className="mt-1 ml-4 space-y-1">
              {courseSubMenu.map((item) => {
                const isSubActive = pathname === '/courses' && 
                  (item.href.includes(`tab=${item.name.split(' ')[0].toLowerCase()}`))
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm transition-colors ${
                      isSubActive
                        ? "bg-gray-700 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{item.icon}</span>
                      <span>{item.name}</span>
                    </div>
                    {item.locked && (
                      <span className="text-gray-500">🔒</span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Partner */}
        <Link
          href="/partner"
          onClick={() => setIsOpen(false)}
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            pathname === '/partner' || pathname.startsWith('/partner/')
              ? "bg-emerald-600 text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <span className="text-xl">🤝</span>
          <span className="font-medium">Partner</span>
        </Link>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors disabled:opacity-50"
        >
          <span className="font-medium">
            {isLoggingOut ? 'กำลังออก...' : 'ออกจากระบบ'}
          </span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ============================================ */}
      {/* Mobile Header - แสดงเฉพาะ Mobile */}
      {/* ============================================ */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Hamburger Button */}
          <button
            onClick={() => setIsOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Open menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/dashboard" className="flex-1 flex justify-center">
            <Image
              src="/logo_wihtetext.png"
              alt={SITE_CONFIG.siteName}
              width={120}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Upgrade Button */}
          {!hasSignal && (
            <Link
              href="/signals"
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              อัพเกรด
            </Link>
          )}
          {hasSignal && <div className="w-16" />} {/* Spacer */}
        </div>
      </div>

      {/* ============================================ */}
      {/* Mobile Sidebar Overlay */}
      {/* ============================================ */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ============================================ */}
      {/* Mobile Sidebar Drawer */}
      {/* ============================================ */}
      <div className={`
        md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-gray-900 text-white
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-800 transition-colors z-10"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="h-full flex flex-col overflow-y-auto">
          <SidebarContent />
        </div>
      </div>

      {/* ============================================ */}
      {/* Desktop Sidebar - แสดงเฉพาะ Desktop */}
      {/* ============================================ */}
      <div className="hidden md:flex h-screen w-64 bg-gray-900 text-white flex-col fixed left-0 top-0">
        <SidebarContent />
      </div>
    </>
  )
}