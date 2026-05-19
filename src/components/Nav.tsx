'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import NotificationBell from './NotificationBell'

// Navigation structure with dropdowns
const NAV_STRUCTURE = {
  Founder: [
    { href: '/', label: 'Dashboard' },
    {
      label: 'Operations',
      items: [
        { href: '/pipeline', label: 'BD Pipeline' },
        { href: '/projects', label: 'Projects' },
        { href: '/estimate', label: 'Estimates' },
        { href: '/qa', label: 'QA' },
      ]
    },
    {
      label: 'Team',
      items: [
        { href: '/team', label: 'Team Scores' },
        { href: '/checkin', label: 'Check-In' },
        { href: '/daily', label: 'Daily' },
        { href: '/goals', label: 'Goals' },
      ]
    },
    {
      label: 'Intelligence',
      items: [
        { href: '/intelligence', label: '⚡ Intel' },
        { href: '/analytics', label: 'Analytics' },
      ]
    },
    { href: '/settings', label: '⚙ Settings' },
  ],
  BD: [
    { href: '/me', label: 'My Day' },
    { href: '/pipeline', label: 'Pipeline' },
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
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
  ],
  Both: [
    { href: '/me', label: 'My Day' },
    { href: '/pipeline', label: 'Pipeline' },
    { href: '/projects', label: 'Projects' },
    { href: '/estimate', label: 'Estimates' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/daily', label: 'Daily' },
  ],
}

const ROLE_COLORS: Record<string, string> = {
  Founder: 'bg-purple-100 text-purple-800',
  BD:      'bg-blue-100 text-blue-800',
  Dev:     'bg-green-100 text-green-800',
  QA:      'bg-teal-100 text-teal-800',
  Both:    'bg-amber-100 text-amber-800',
}

function NavDropdown({ label, items, currentPath }: { label: string; items: { href: string; label: string }[]; currentPath: string }) {
  const [open, setOpen] = useState(false)
  const isActive = items.some(item => currentPath === item.href || currentPath.startsWith(item.href + '/'))

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap flex items-center gap-1 ${
          isActive
            ? 'bg-gray-900 text-white'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        {label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 pt-1">
          <div className="w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  currentPath === item.href || currentPath.startsWith(item.href + '/')
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Nav() {
  const path = usePathname()
  const { data: session } = useSession()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)

  const role = session?.user?.role ?? ''
  const firstName = (session?.user?.name ?? '').split(' ')[0]
  const navItems = NAV_STRUCTURE[role as keyof typeof NAV_STRUCTURE] || []

  async function handleSignOut() {
    setSigningOut(true)
    await signOut({ callbackUrl: '/login' })
  }

  if (!session?.user) return null

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-semibold text-gray-900 mr-4 text-sm tracking-tight flex-shrink-0">
          Agency Ops
        </span>

        {/* Navigation Links */}
        <div className="flex items-center gap-0.5 flex-1">
          {navItems.map((item, idx) =>
            'items' in item ? (
              <NavDropdown key={idx} label={item.label} items={item.items} currentPath={path} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  path === item.href || (item.href !== '/' && path.startsWith(item.href))
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Right Section: Notifications & User Menu */}
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <NotificationBell />

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm text-gray-700 font-medium hidden sm:block">{firstName}</span>
              {role && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
                  {role}
                </span>
              )}
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setUserDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/account"
                      onClick={() => setUserDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Account Settings
                    </Link>
                    <button
                      onClick={() => {
                        setUserDropdownOpen(false)
                        handleSignOut()
                      }}
                      disabled={signingOut}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {signingOut ? 'Signing out...' : 'Sign Out'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
