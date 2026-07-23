'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import NotificationBell from './NotificationBell'

const NAV_STRUCTURE = {
  Founder: [
    { href: '/', label: 'Dashboard' },
    {
      label: 'Operations',
      items: [
        { href: '/pipeline', label: 'BD Pipeline' },
        { href: '/mom', label: 'MOM' },
        { href: '/campaigns', label: 'Campaigns' },
        { href: '/projects', label: 'Projects' },
        { href: '/estimate', label: 'Estimates' },
        { href: '/qa', label: 'QA' },
      ],
    },
    {
      label: 'Team',
      items: [
        { href: '/team', label: 'Team Scores' },
        { href: '/checkin', label: 'Check-In' },
        { href: '/daily', label: 'Daily' },
        { href: '/goals', label: 'Goals' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { href: '/intelligence', label: 'Intel' },
        { href: '/analytics', label: 'Analytics' },
      ],
    },
    { href: '/settings', label: 'Settings' },
  ],
  Manager: [
    { href: '/', label: 'Dashboard' },
    {
      label: 'Operations',
      items: [
        { href: '/pipeline', label: 'BD Pipeline' },
        { href: '/mom', label: 'MOM' },
        { href: '/campaigns', label: 'Campaigns' },
        { href: '/projects', label: 'Projects' },
        { href: '/estimate', label: 'Estimates' },
        { href: '/qa', label: 'QA' },
      ],
    },
    {
      label: 'Team',
      items: [
        { href: '/team', label: 'Team Scores' },
        { href: '/checkin', label: 'Check-In' },
        { href: '/daily', label: 'Daily' },
        { href: '/goals', label: 'Goals' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { href: '/intelligence', label: 'Intel' },
        { href: '/analytics', label: 'Analytics' },
      ],
    },
    { href: '/settings', label: 'Settings' },
  ],
  BD: [
    { href: '/me', label: 'My Day' },
    { href: '/pipeline', label: 'Pipeline' },
    { href: '/mom', label: 'MOM' },
    { href: '/campaigns', label: 'Campaigns' },
    { href: '/projects', label: 'Projects' },
    { href: '/estimate', label: 'Estimates' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
  ],
  Dev: [
    { href: '/me', label: 'My Day' },
    { href: '/projects', label: 'Projects' },
    { href: '/estimate', label: 'Estimates' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
  ],
  QA: [
    { href: '/me', label: 'My Day' },
    { href: '/qa', label: 'QA' },
    { href: '/qa/activity', label: 'Activity' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
  ],
  HR: [
    { href: '/me', label: 'My Day' },
    { href: '/team', label: 'Team' },
    { href: '/daily', label: 'Daily' },
  ],
  SocialMedia: [
    { href: '/me', label: 'My Day' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
  ],
  Both: [
    { href: '/me', label: 'My Day' },
    { href: '/pipeline', label: 'Pipeline' },
    { href: '/mom', label: 'MOM' },
    { href: '/campaigns', label: 'Campaigns' },
    { href: '/projects', label: 'Projects' },
    { href: '/estimate', label: 'Estimates' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
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

function NavDropdown({
  label,
  items,
  currentPath,
}: {
  label: string
  items: { href: string; label: string }[]
  currentPath: string
}) {
  const [open, setOpen] = useState(false)
  const isActive = items.some(item => isLinkActive(currentPath, item.href))

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(!open)} className={`${navLinkClass(isActive)} flex items-center gap-1`}>
        {label}
        <svg
          className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 pt-1.5 z-50">
          <div className="w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {items.map(item => {
              const active = isLinkActive(currentPath, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block px-3 py-2 text-sm ${
                    active ? 'bg-gray-50 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
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
              <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
              {email && <p className="text-xs text-gray-500 truncate mt-0.5">{email}</p>}
            </div>
          </div>
          {role && (
            <span className={`inline-flex mt-3 text-[11px] px-2.5 py-0.5 rounded-full font-medium ${roleCls}`}>
              {role === 'SocialMedia' ? 'Social Media' : role}
            </span>
          )}
        </div>

        <div className="p-1.5">
          <Link
            href="/account"
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

export default function Nav() {
  const path = usePathname()
  const { data: session } = useSession()
  const [signingOut, setSigningOut] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const role = session?.user?.role ?? ''
  const firstName = (session?.user?.name ?? '').split(' ')[0]
  const fullName = session?.user?.name ?? ''
  const navItems = NAV_STRUCTURE[role as keyof typeof NAV_STRUCTURE] || []
  const homeHref = role === 'Founder' || role === 'Manager' ? '/' : '/me'
  const roleLabel = role === 'SocialMedia' ? 'Social' : role

  async function handleSignOut() {
    setSigningOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  if (!session?.user) return null

  return (
    <header className="sticky top-0 z-50 bg-gray-50 pt-3 pb-2">
      <div className="app-header">
        <div className="flex h-12 items-center justify-between gap-4 px-3 sm:px-4 bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Link href={homeHref} className="flex items-center gap-2 shrink-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-900 text-[10px] font-bold text-white">
                AO
              </span>
              <span className="font-semibold text-gray-900 text-sm tracking-tight hidden sm:block">Agency Ops</span>
            </Link>

            <nav className="flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-hide">
              {navItems.map((item, idx) =>
                'items' in item ? (
                  <NavDropdown key={idx} label={item.label} items={item.items} currentPath={path} />
                ) : (
                  <Link key={item.href} href={item.href} className={navLinkClass(isLinkActive(path, item.href))}>
                    {item.label}
                  </Link>
                )
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex items-center gap-2 rounded-lg border border-gray-200 pl-1 pr-2 py-1 transition-colors ${
                  userDropdownOpen ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <UserAvatar name={fullName} />
                <span className="hidden sm:inline text-sm font-medium text-gray-900">{firstName}</span>
                {role && (
                  <span
                    className={`hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {roleLabel}
                  </span>
                )}
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform ${userDropdownOpen ? 'rotate-180' : ''}`}
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
                email={session.user.email}
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
  )
}
