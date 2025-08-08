import { NextRequest, NextResponse } from 'next/server'

const protectedRoutes = [
  '/dashboard',
  '/dashboard/settings',
  '/dashboard/analytics',
  '/dashboard/query-builder',
  '/dashboard/monitoring',
  '/dashboard/schema',
  '/dashboard/team',
  '/dashboard/security',
  '/dashboard/alerts',
  '/dashboard/reports',
  '/onboarding'
]

const authRoutes = [
  '/auth/signin',
  '/auth/signup'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  // Check if the current path is an auth route
  const isAuthRoute = authRoutes.some(route => 
    pathname.startsWith(route)
  )

  if (isProtectedRoute || isAuthRoute) {
    // Simple cookie-based auth check for Edge runtime compatibility
    const sessionCookie = request.cookies.get('better-auth.session_token')
    const hasSession = !!sessionCookie?.value

    // If accessing protected route without session cookie, redirect to signin
    if (isProtectedRoute && !hasSession) {
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // If accessing auth route with session cookie, redirect to dashboard
    if (isAuthRoute && hasSession) {
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public|images).*)',
  ],
} 