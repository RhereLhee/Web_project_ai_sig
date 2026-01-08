// lib/AuthContext.tsx
"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  referralCode?: string
  subscription?: {
    status: string
    endAt: string | null
    plan: { name: string }
  } | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: { email: string; password: string; name?: string; referralCode?: string }) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  // Fetch current user
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // Auto refresh token ก่อน access หมดอายุ
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (user) {
        try {
          const res = await fetch('/api/auth/refresh', { method: 'POST' })
          if (!res.ok) {
            // Refresh failed → logout
            setUser(null)
            router.push('/login')
          }
        } catch {
          // Network error → อาจจะ offline
        }
      }
    }, 90 * 1000) // Refresh ทุก 90 วินาที (ก่อน 2 นาทีหมดอายุ)
    
    return () => clearInterval(refreshInterval)
  }, [user, router])
  
  // Initial load
  useEffect(() => {
    refreshUser()
  }, [refreshUser])
  
  // Login
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        setUser(data.user)
        return { success: true }
      }
      
      return { success: false, error: data.error }
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาด' }
    }
  }
  
  // Register
  const register = async (data: { email: string; password: string; name?: string; referralCode?: string }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      
      const result = await res.json()
      
      if (res.ok) {
        setUser(result.user)
        return { success: true }
      }
      
      return { success: false, error: result.error }
    } catch {
      return { success: false, error: 'เกิดข้อผิดพลาด' }
    }
  }
  
  // Logout
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      router.push('/login')
    }
  }
  
  // Logout all devices
  const logoutAll = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'DELETE' })
    } finally {
      setUser(null)
      router.push('/login')
    }
  }
  
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, logoutAll, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
