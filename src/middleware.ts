import { auth, ROLE_ACCESS } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Always allow: login page, NextAuth internals, static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Not logged in → redirect to login
  if (!session?.user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const role = session.user.role as string
  const allowedPaths = ROLE_ACCESS[role] ?? []

  // Founder sees everything
  if (role === 'Founder') return NextResponse.next()

  // Check if the current path is allowed for this role
  const allowed = allowedPaths.some(allowed =>
    pathname === allowed || pathname.startsWith(allowed + '/')
  )

  // API routes: check based on the page they correspond to
  if (pathname.startsWith('/api/')) {
    const apiAllowed = checkApiAccess(pathname, role)
    if (!apiAllowed) {
      return NextResponse.json(
        { error: 'Access denied. Your role does not have permission for this action.' },
        { status: 403 }
      )
    }
    return NextResponse.next()
  }

  if (!allowed) {
    // Non-Founders land on their personal home page
    const home = role === 'Founder' ? '/' : '/me'
    return NextResponse.redirect(new URL(home, req.url))
  }

  return NextResponse.next()
})

function checkApiAccess(path: string, role: string): boolean {
  // All authenticated users can manage their own account.
  if (path.startsWith('/api/account')) return true

  // Entity audit trails are visible to authenticated users who can access the
  // underlying page. The system-wide audit route still enforces Founder-only
  // access in its route handler.
  if (path.startsWith('/api/audit')) return true

  // BD can access lead/proposal/estimation/project APIs
  if (['BD', 'Both', 'Founder'].includes(role)) {
    if (path.startsWith('/api/leads') || path.startsWith('/api/estimate') || path.startsWith('/api/projects')) return true
  }
  // Dev can access project/daily/checkin/estimate APIs
  if (['Dev', 'Both', 'Founder'].includes(role)) {
    if (
      path.startsWith('/api/projects') ||
      path.startsWith('/api/daily') ||
      path.startsWith('/api/scores') ||
      path.startsWith('/api/estimate')
    ) return true
  }
  // BD can access daily APIs
  if (['BD', 'Both', 'Founder'].includes(role)) {
    if (path.startsWith('/api/daily')) return true
  }
  // QA can access QA and bug APIs, plus milestone updates and daily plans
  if (['QA', 'Founder'].includes(role)) {
    if (
      path.startsWith('/api/qa') ||
      path.startsWith('/api/blockers') ||
      path.startsWith('/api/projects/milestones') ||
      path.startsWith('/api/daily')
    ) return true
  }
  // Everyone can access scores, notifications
  if (path.startsWith('/api/scores') || path.startsWith('/api/notifications')) return true
  return false
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
