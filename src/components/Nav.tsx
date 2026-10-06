'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import NotificationBell from './NotificationBell'
import NavCountBadge from './NavCountBadge'
import { useNavigationPending } from './NavigationProvider'
import { usePendingLeaveCount } from '@/hooks/usePendingLeaveCount'
import type { Branding } from '@/lib/branding'
import { shortDisplayName } from '@/lib/employee-order'

/** Warm these on idle so the first intentional click is already cached. */
const PRIMARY_PREFETCH: Record<string, string[]> = {
  Founder: ['/', '/projects', '/mom', '/leaves'],
  Manager: ['/', '/projects', '/mom', '/leaves'],
  Dev: ['/me', '/projects', '/daily', '/leaves', '/checkin'],
  BD: ['/me', '/pipeline', '/projects', '/daily', '/leaves'],
  Both: ['/me', '/projects', '/pipeline', '/daily', '/leaves'],
  QA: ['/me', '/qa', '/daily', '/leaves', '/checkin'],
  HR: ['/me', '/team', '/daily', '/leaves'],
  SocialMedia: ['/me', '/daily', '/leaves', '/checkin'],
}

/**
 * Founder / Manager (leads) — trimmed to 5 top-level items.
 * Dev/QA tooling (Check-In, Estimates, QA, QA activity) is intentionally not
 * listed; those routes stay reachable by URL. Settings lives in the user menu.
 */
const LEAD_NAV = [
  { href: '/', label: 'Needs you' },
  {
    label: 'People',
    items: [
      { href: '/leaves', label: 'Leaves & WFH' },
      { href: '/daily', label: 'Daily updates' },
      { href: '/goals', label: 'Goals' },
    ],
  },
  { href: '/projects', label: 'Projects' },
  {
    label: 'Sales',
    items: [
      { href: '/mom', label: 'Meetings (MOM)' },
      { href: '/pipeline', label: 'Pipeline' },
      { href: '/campaigns', label: 'Campaigns' },
      { href: '/salesrobot', label: 'SalesRobot' },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/overview', label: 'Business' },
      { href: '/reports/team', label: 'Team' },
    ],
  },
]

const NAV_STRUCTURE = {
  Founder: LEAD_NAV,
  Manager: LEAD_NAV,
  BD: [
    { href: '/me', label: 'My Day' },
    {
      label: 'Work',
      items: [
        { href: '/pipeline', label: 'Pipeline' },
        { href: '/mom', label: 'MOM' },
        { href: '/campaigns', label: 'Campaigns' },
        { href: '/salesrobot', label: 'SalesRobot' },
        { href: '/projects', label: 'Projects' },
        { href: '/qa', label: 'QA' },
        { href: '/qa/activity', label: 'QA activity' },
        { href: '/estimate', label: 'Estimates' },
      ],
    },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
    { href: '/leaves', label: 'Leaves' },
  ],
  Dev: [
    { href: '/me', label: 'My Day' },
    { href: '/projects', label: 'Projects' },
    { href: '/estimate', label: 'Estimates' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
    { href: '/leaves', label: 'Leaves' },
  ],
  QA: [
    { href: '/me', label: 'My Day' },
    { href: '/qa', label: 'QA' },
    { href: '/qa/activity', label: 'Activity' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
    { href: '/leaves', label: 'Leaves' },
  ],
  HR: [
    { href: '/me', label: 'My Day' },
    { href: '/team', label: 'Team' },
    { href: '/daily', label: 'Daily' },
    { href: '/leaves', label: 'Leaves' },
  ],
  SocialMedia: [
    { href: '/me', label: 'My Day' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
    { href: '/leaves', label: 'Leaves' },
  ],
  Both: [
    { href: '/me', label: 'My Day' },
    {
      label: 'Work',
      items: [
        { href: '/pipeline', label: 'Pipeline' },
        { href: '/mom', label: 'MOM' },
        { href: '/campaigns', label: 'Campaigns' },
        { href: '/salesrobot', label: 'SalesRobot' },
        { href: '/projects', label: 'Projects' },
        { href: '/qa', label: 'QA' },
        { href: '/qa/activity', label: 'QA activity' },
        { href: '/estimate', label: 'Estimates' },
      ],
    },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
    { href: '/leaves', label: 'Leaves' },
  ],
}

const ROLE_COLORS: Record<string, string> = {
  Founder: 'bg-purple-100 text-purple-700',
  Manager: 'bg-indigo-100 text-indigo-700',
  BD: 'bg-blue-100 text-blue-700',
  Dev: 'bg-green-100 text-green-700',
  QA: 'bg-teal-100 text-teal-700',
  HR: 'bg-rose-100 text-rose-700',
  SocialMedia: 'bg-pink-100 text-pink-700',
  Both: 'bg-amber-100 text-amber-700',
}

function isLinkActive(path: string, href: string) {
  if (path === href) return true
  if (href === '/') return false
  if (href === '/qa' && path.startsWith('/qa/activity')) return false
  return path.startsWith(href + '/')
}

function navLinkClass(active: boolean) {
  return `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
    active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
  }`
}

function NavLink({
  href,
  children,
  active,
  onNavigate,
  onPrefetch,
  badgeCount = 0,
}: {
  href: string
  children: ReactNode
  active: boolean
  onNavigate: () => void
  onPrefetch: (href: string) => void
  badgeCount?: number
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={() => onPrefetch(href)}
      onFocus={() => onPrefetch(href)}
      onPointerDown={() => onPrefetch(href)}
      onClick={onNavigate}
      className={`${navLinkClass(active)} inline-flex items-center`}
    >
      {children}
      <NavCountBadge count={badgeCount} active={active} />
    </Link>
  )
}

function NavDropdown({
  label,
  items,
  currentPath,
  onNavigate,
  onPrefetch,
  leaveBadgeCount = 0,
}: {
  label: string
  items: { href: string; label: string }[]
  currentPath: string
  onNavigate: () => void
  onPrefetch: (href: string) => void
  leaveBadgeCount?: number
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const isActive = items.some(item => isLinkActive(currentPath, item.href))
  const hasLeaveItem = items.some(item => item.href === '/leaves' || item.href.startsWith('/leaves/'))
  const triggerBadge = hasLeaveItem ? leaveBadgeCount : 0

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        setOpen(true)
        items.forEach(item => onPrefetch(item.href))
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className={`${navLinkClass(isActive)} inline-flex items-center gap-1`}
      >
        {label}
        <svg
          className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <NavCountBadge count={triggerBadge} active={isActive} />
      </button>

      {open && (
        <div className="absolute top-full left-0 pt-1 z-[80]">
          <div className="w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5">
            {items.map(item => {
              const active = isLinkActive(currentPath, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  onMouseEnter={() => onPrefetch(item.href)}
                  onFocus={() => onPrefetch(item.href)}
                  onPointerDown={() => onPrefetch(item.href)}
                  onClick={() => {
                    onNavigate()
                    setOpen(false)
                  }}
                  className={`flex items-center px-3 py-2 text-sm ${
                    active ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                  {(item.href === '/leaves' || item.href.startsWith('/leaves/')) ? (
                    <NavCountBadge count={leaveBadgeCount} />
                  ) : null}
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function UserAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const sizeClass = size === 'lg' ? 'h-10 w-10 text-sm' : 'h-7 w-7 text-[10px]'

  return (
    <span
      className={`flex items-center justify-center rounded-full bg-gray-900 font-semibold text-white shrink-0 ${sizeClass}`}
    >
      {initials}
    </span>
  )
}

function UserMenuDropdown({
  open,
  onClose,
  name,
  email,
  role,
  signingOut,
  onSignOut,
}: {
  open: boolean
  onClose: () => void
  name: string
  email: string | null | undefined
  role: string
  signingOut: boolean
  onSignOut: () => void
}) {
  if (!open) return null

  const roleCls = ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl z-20 overflow-hidden">
        <div className="px-4 py-4 bg-gradient-to-br from-gray-50 to-white border-b border-gray-100">
          <div className="flex items-center gap-3">
            <UserAvatar name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                {role && (
                  <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${roleCls}`}>
                    {role === 'SocialMedia' ? 'Social' : role}
                  </span>
                )}
              </div>
              {email && <p className="text-xs text-gray-500 truncate mt-0.5">{email}</p>}
            </div>
          </div>
        </div>

        <div className="p-1.5">
          <Link
            href="/account"
            prefetch={false}
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </span>
            <div>
              <div className="font-medium text-gray-900">Account settings</div>
              <div className="text-xs text-gray-500">Profile & notifications</div>
            </div>
          </Link>

          {(role === 'Founder' || role === 'Manager') && (
            <Link
              href="/settings"
              prefetch={false}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h10M4 18h7" />
                </svg>
              </span>
              <div>
                <div className="font-medium text-gray-900">Company settings</div>
                <div className="text-xs text-gray-500">Team, branding & audit log</div>
              </div>
            </Link>
          )}

          <button
            type="button"
            onClick={onSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 group-hover:bg-red-100">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </span>
            <div className="text-left">
              <div className="font-medium">{signingOut ? 'Signing out...' : 'Sign out'}</div>
              <div className="text-xs text-gray-500">End your session</div>
            </div>
          </button>
        </div>
      </div>
    </>
  )
}

type NavUser = { name: string; email: string; role: string }

export default function Nav({
  branding,
  initialUser = null,
}: {
  branding: Branding
  /** Server session — keeps header visible if client useSession is briefly empty (common on local). */
  initialUser?: NavUser | null
}) {
  const path = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { startNavigation } = useNavigationPending()
  const [signingOut, setSigningOut] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const user = session?.user
    ? {
        name: session.user.name ?? '',
        email: session.user.email ?? '',
        role: session.user.role ?? '',
      }
    : initialUser
  const role = user?.role ?? ''
  const firstName = shortDisplayName(user?.name ?? '')
  const fullName = user?.name ?? ''
  const navItems = NAV_STRUCTURE[role as keyof typeof NAV_STRUCTURE] || []
  const homeHref = role === 'Founder' || role === 'Manager' ? '/' : '/me'
  const roleLabel = role === 'SocialMedia' ? 'Social' : role
  const prefetched = useRef(new Set<string>())
  // Pending-leave badge is for HR only — leave approval is HR work. Founder / Manager
  // can still open and act on /leaves (access unchanged); they just don't get the badge.
  const showLeaveBadge = role === 'HR'
  const pendingLeaveCount = usePendingLeaveCount(showLeaveBadge)

  function prefetchHref(href: string) {
    if (prefetched.current.has(href)) return
    prefetched.current.add(href)
    router.prefetch(href)
  }

  // After login / first paint, warm primary routes in the background (staggered)
  useEffect(() => {
    if (!role) return
    const hrefs = PRIMARY_PREFETCH[role] ?? [homeHref]
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []

    const run = () => {
      hrefs.forEach((href, i) => {
        timers.push(
          setTimeout(() => {
            if (!cancelled) prefetchHref(href)
          }, 400 + i * 350),
        )
      })
    }

    const ric = window.requestIdleCallback?.(run, { timeout: 2000 })
    if (ric == null) {
      timers.push(setTimeout(run, 600))
    }

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      if (ric != null) window.cancelIdleCallback?.(ric)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- warm once per role session
  }, [role, homeHref, router])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileNavOpen(false)
  }, [path])

  useEffect(() => {
    if (!mobileNavOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  function handleNavigate() {
    startNavigation()
    setMobileNavOpen(false)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  if (!user) return null

  return (
    <>
    <header className="sticky top-0 z-50 bg-gray-50 pt-3 pb-2 px-3 sm:px-0">
      <div className="app-header sm:px-0">
        <div className="flex h-12 items-center gap-2 sm:gap-3 px-2.5 sm:px-4 bg-white border border-gray-200 rounded-xl shadow-sm overflow-visible">
          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 shrink-0 -ml-0.5"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(open => !open)}
          >
            {mobileNavOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1 overflow-visible">
            <Link
              href={homeHref}
              prefetch={false}
              onMouseEnter={() => prefetchHref(homeHref)}
              onPointerDown={() => prefetchHref(homeHref)}
              onClick={handleNavigate}
              className="flex items-center gap-2 shrink-0"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-[10px] font-bold text-white">
                {branding.initials}
              </span>
              <span className="font-semibold text-gray-900 text-sm tracking-tight hidden sm:block md:hidden lg:block">
                {branding.name}
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-0.5 min-w-0 overflow-visible">
              {navItems.map((item, idx) =>
                'items' in item && item.items ? (
                  <NavDropdown
                    key={idx}
                    label={item.label}
                    items={item.items}
                    currentPath={path}
                    onNavigate={handleNavigate}
                    onPrefetch={prefetchHref}
                    leaveBadgeCount={pendingLeaveCount}
                  />
                ) : 'href' in item ? (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    active={isLinkActive(path, item.href)}
                    onNavigate={handleNavigate}
                    onPrefetch={prefetchHref}
                    badgeCount={item.href === '/leaves' ? pendingLeaveCount : 0}
                  >
                    {item.label}
                  </NavLink>
                ) : null
              )}
            </nav>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            <NotificationBell />

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex items-center gap-2 rounded-lg border border-gray-200 pl-1 pr-1.5 sm:pr-2 py-1 transition-colors max-w-[11rem] sm:max-w-none ${
                  userDropdownOpen ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <UserAvatar name={fullName} />
                <span className="hidden sm:inline text-sm font-medium text-gray-900 truncate max-w-[5.5rem]">
                  {firstName}
                </span>
                {role && (
                  <span
                    className={`hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {roleLabel}
                  </span>
                )}
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <UserMenuDropdown
                open={userDropdownOpen}
                onClose={() => setUserDropdownOpen(false)}
                name={fullName}
                email={user.email}
                role={role}
                signingOut={signingOut}
                onSignOut={() => {
                  setUserDropdownOpen(false)
                  handleSignOut()
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </header>

      {/* Outside sticky header so fixed positioning is viewport-relative */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            className="absolute inset-0 bg-gray-900/40"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute top-0 left-0 bottom-0 flex w-[min(100%,20rem)] flex-col bg-white shadow-xl ring-1 ring-black/5 animate-[nav-drawer-in_0.2s_ease-out]">
            <div className="shrink-0 flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-[11px] font-bold text-white shrink-0">
                  {branding.initials}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{branding.name}</div>
                  <div className="text-[11px] text-gray-500 truncate">{firstName} · {roleLabel}</div>
                </div>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-3 space-y-4">
              {(() => {
                // Bundle consecutive top-level links so Check-In / Daily / Leaves
                // use the same tight spacing as Work submenu items.
                type MobileChunk =
                  | { kind: 'section'; label: string; items: { href: string; label: string }[] }
                  | { kind: 'links'; items: { href: string; label: string }[] }
                const chunks: MobileChunk[] = []
                for (const item of navItems) {
                  if ('items' in item && item.items) {
                    chunks.push({ kind: 'section', label: item.label, items: item.items })
                  } else if ('href' in item && item.href) {
                    const last = chunks[chunks.length - 1]
                    if (last?.kind === 'links') last.items.push({ href: item.href, label: item.label })
                    else chunks.push({ kind: 'links', items: [{ href: item.href, label: item.label }] })
                  }
                }

                function mobileLink(href: string, label: string) {
                  const active = isLinkActive(path, href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      prefetch={false}
                      onClick={handleNavigate}
                      onPointerDown={() => prefetchHref(href)}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{label}</span>
                      <NavCountBadge
                        count={href === '/leaves' ? pendingLeaveCount : 0}
                        active={active}
                      />
                    </Link>
                  )
                }

                return chunks.map((chunk, idx) =>
                  chunk.kind === 'section' ? (
                    <div key={`section-${idx}`} className="space-y-1">
                      <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        {chunk.label}
                      </div>
                      <div className="space-y-1">{chunk.items.map(i => mobileLink(i.href, i.label))}</div>
                    </div>
                  ) : (
                    <div key={`links-${idx}`} className="space-y-1">
                      {chunk.items.map(i => mobileLink(i.href, i.label))}
                    </div>
                  )
                )
              })()}
            </nav>

            <div className="shrink-0 border-t border-gray-100 p-3">
              <Link
                href="/account"
                prefetch={false}
                onClick={handleNavigate}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <UserAvatar name={fullName} />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{fullName || firstName}</div>
                  <div className="text-xs text-gray-500">Account settings</div>
                </div>
              </Link>
              {(role === 'Founder' || role === 'Manager') && (
                <Link
                  href="/settings"
                  prefetch={false}
                  onClick={handleNavigate}
                  className="mt-1 flex items-center rounded-xl px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Company settings
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
