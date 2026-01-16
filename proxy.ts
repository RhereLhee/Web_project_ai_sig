import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || 'access-secret-key-min-32-chars!!'
)
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || 'refresh-secret-key-min-32-chars!!'
)

const protectedRoutes = ['/dashboard', '/signals', '/courses', '/profile', '/pricing', '/checkout', '/admin', '/affiliate', '/partner']
const authRoutes = ['/login', '/register']
const adminRoutes = ['/admin']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('access_token')?.value
  const refreshToken = request.cookies.get('refresh_token')?.value

  let isAuthenticated = false
  let userRole: string | null = null

  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, ACCESS_SECRET)
      isAuthenticated = true
      userRole = (payload as any).role || null
    } catch {}
  }

  if (!isAuthenticated && refreshToken) {
    try {
      const { payload } = await jwtVerify(refreshToken, REFRESH_SECRET)
      isAuthenticated = true
      userRole = (payload as any).role || null
    } catch {}
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const isAuthRoute = authRoutes.some(route => pathname === route)
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  if (isAdminRoute && (!isAuthenticated || userRole !== 'ADMIN')) {
    return NextResponse.redirect(new URL(isAuthenticated ? '/dashboard' : '/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/signals/:path*', '/courses/:path*', '/profile/:path*', '/pricing/:path*', '/checkout/:path*', '/admin/:path*', '/affiliate/:path*', '/partner/:path*', '/login', '/register']
}