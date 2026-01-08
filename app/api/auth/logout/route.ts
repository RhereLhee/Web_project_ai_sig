import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, clearAuthCookies } from '@/lib/jwt'

// GET - สำหรับกดลิงก์ logout (redirect ไป login)
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (user) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { refreshToken: null }
      })
    }
    
    await clearAuthCookies()
    
    // Redirect ไปหน้า login
    return NextResponse.redirect(new URL('/login', req.url))
    
  } catch (error) {
    console.error('Logout error:', error)
    await clearAuthCookies()
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

// POST - สำหรับเรียกผ่าน fetch
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (user) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { refreshToken: null }
      })
    }
    
    await clearAuthCookies()
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Logout error:', error)
    await clearAuthCookies()
    return NextResponse.json({ success: true })
  }
}

// DELETE - สำหรับ logout ทุกเครื่อง
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (user) {
      await prisma.user.update({
        where: { id: user.userId },
        data: { 
          refreshToken: null,
          tokenVersion: { increment: 1 }
        }
      })
    }
    
    await clearAuthCookies()
    
    return NextResponse.json({ 
      success: true,
      message: 'Logged out from all devices'
    })
    
  } catch (error) {
    console.error('Logout all error:', error)
    await clearAuthCookies()
    return NextResponse.json({ success: true })
  }
}