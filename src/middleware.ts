import { auth, ROLE_ACCESS } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Login page: redirect authenticated users to their home
  if (pathname === '/login') {
    if (session?.user) {
      const rawCallback = req.nextUrl.searchParams.get('callbackUrl')
      const callbackUrl =
        rawCallback?.startsWith('/') && !rawCallback.startsWith('//') && rawCallback !== '/login'
          ? rawCallback
          : null
      const role = session.user.role as string
      const defaultHome = ['Founder', 'Manager'].includes(role) ? '/' : '/me'
      const destination = callbackUrl ?? defaultHome
      return NextResponse.redirect(new URL(destination, req.url))
    }
    return NextResponse.next()
  }

  // Always allow: NextAuth internals, static assets
  if (
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

  // Personal pages — every authenticated user
  // Founders/Managers belong on the team dashboard; bounce /me here (not in the page)
  // so we avoid a Server Component redirect() that can flash a client React error.
  if (pathname === '/me' || pathname.startsWith('/me/')) {
    const role = session.user.role as string
    if (role === 'Founder' || role === 'Manager') {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }
  if (pathname === '/account' || pathname.startsWith('/account/')) {
    return NextResponse.next()
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
    const home = ['Founder', 'Manager'].includes(role) ? '/' : '/me'
    if (pathname !== home && !pathname.startsWith(home + '/')) {
      return NextResponse.redirect(new URL(home, req.url))
    }
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

  // BD can access lead/proposal/estimation/project/MOM APIs
  if (['BD', 'Both', 'Founder', 'Manager'].includes(role)) {
    if (
      path.startsWith('/api/leads') ||
      path.startsWith('/api/estimate') ||
      path.startsWith('/api/projects') ||
      path.startsWith('/api/mom') ||
      path.startsWith('/api/campaigns')
    ) return true
  }
  // Dev can access project/daily/checkin/estimate APIs
  if (['Dev', 'Both', 'Founder'].includes(role)) {
    if (
      path.startsWith('/api/projects') ||
      path.startsWith('/api/daily') ||
      path.startsWith('/api/scores') ||
      path.startsWith('/api/estimate') ||
      path.startsWith('/api/qa/cycle-cases')
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
  // HR: daily plans and EOD
  if (role === 'HR') {
    if (path.startsWith('/api/daily')) return true
  }
  // Social Media: daily + weekly check-in scores
  if (role === 'SocialMedia') {
    if (path.startsWith('/api/daily') || path.startsWith('/api/scores')) return true
  }
  // Everyone can access scores, notifications, apply for leaves, and project check-ins
  if (
    path.startsWith('/api/scores') || 
    path.startsWith('/api/notifications') || 
    path.startsWith('/api/leaves') ||
    path.match(/^\/api\/projects\/[^/]+\/checkin/)
  ) return true
  return false
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
