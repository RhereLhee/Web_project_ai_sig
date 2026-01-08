"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X, TrendingUp, User, LogOut, Settings, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

interface HeaderProps {
  user?: {
    name?: string | null
    email?: string | null
    image?: string | null
  } | null
}

const navLinks = [
  { href: "/courses", label: "ห้องเรียน" },
  { href: "/signals", label: "Signal" },
  { href: "/pricing", label: "ราคา" },
]

export function Header({ user }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative bg-gradient-to-r from-emerald-500 to-cyan-500 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-black" />
            </div>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            TechTrade
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-gray-400 hover:text-white transition-colors relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border-2 border-emerald-500/50">
                    <AvatarImage src={user.image || ""} alt={user.name || ""} />
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-black font-bold">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-gray-900 border-gray-800" align="end">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback className="bg-emerald-500 text-black text-xs">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">{user.name}</span>
                    <span className="text-xs text-gray-400">{user.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer text-gray-300 hover:text-white">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer text-gray-300 hover:text-white">
                    <User className="mr-2 h-4 w-4" />
                    โปรไฟล์
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile?tab=wallet" className="cursor-pointer text-gray-300 hover:text-white">
                    <Wallet className="mr-2 h-4 w-4" />
                    กระเป๋าเงิน
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-gray-800" />
                <DropdownMenuItem className="cursor-pointer text-red-400 hover:text-red-300">
                  <LogOut className="mr-2 h-4 w-4" />
                  ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  เข้าสู่ระบบ
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold hover:opacity-90 transition-opacity">
                  สมัครสมาชิก
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="text-white">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 bg-gray-950 border-gray-800">
            <div className="flex flex-col gap-6 mt-8">
              {/* Mobile Nav Links */}
              <nav className="flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="text-lg text-gray-300 hover:text-white transition-colors py-2 border-b border-gray-800"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {/* Mobile Auth */}
              {user ? (
                <div className="flex flex-col gap-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-emerald-500/50">
                      <AvatarImage src={user.image || ""} />
                      <AvatarFallback className="bg-emerald-500 text-black font-bold">
                        {user.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-sm text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" className="w-full border-gray-700 text-white">
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/profile" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" className="w-full border-gray-700 text-white">
                      โปรไฟล์
                    </Button>
                  </Link>
                  <Button variant="ghost" className="w-full text-red-400 hover:text-red-300">
                    ออกจากระบบ
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                  <Link href="/login" onClick={() => setIsOpen(false)}>
                    <Button variant="outline" className="w-full border-gray-700 text-white">
                      เข้าสู่ระบบ
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-semibold">
                      สมัครสมาชิก
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
