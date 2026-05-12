'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import NotificationBell from './NotificationBell'

const ALL_LINKS = [
  { href: '/me',           label: 'My Day',      roles: ['BD','Dev','QA','Both'] },
  { href: '/',             label: 'Dashboard',   roles: ['Founder'] },
  { href: '/intelligence', label: '⚡ Intel',     roles: ['Founder'] },
  { href: '/pipeline',     label: 'BD Pipeline', roles: ['Founder','BD','Both','Manager'] },
  { href: '/estimate',     label: 'Estimates',   roles: ['Founder','BD','Both','Dev','Manager'] },
  { href: '/projects',     label: 'Projects',    roles: ['Founder','Dev','Both','Manager'] },
  { href: '/qa',           label: 'QA',          roles: ['Founder','QA'] },
  { href: '/team',         label: 'Team Scores', roles: ['Founder'] },
  { href: '/checkin',      label: 'Check-In',    roles: ['Founder','BD','Dev','QA','Both'] },
  { href: '/daily',        label: 'Daily',       roles: ['Founder','BD','Dev','QA','Both'] },
  { href: '/analytics',    label: 'Analytics',   roles: ['Founder'] },
  { href: '/goals',        label: 'Goals',       roles: ['Founder'] },
  { href: '/settings',     label: '⚙ Settings',  roles: ['Founder','Manager'] },
]

const ROLE_COLORS: Record<string, string> = {
  Founder: 'bg-purple-100 text-purple-800',
  BD:      'bg-blue-100 text-blue-800',
  Dev:     'bg-green-100 text-green-800',
  QA:      'bg-teal-100 text-teal-800',
  Both:    'bg-amber-100 text-amber-800',
}

export default function Nav() {
  const path = usePathname()
  const { data: session } = useSession()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const role = session?.user?.role ?? ''
  const firstName = (session?.user?.name ?? '').split(' ')[0]
  const links = ALL_LINKS.filter(l => l.roles.includes(role))

  async function handleSignOut() {
    setSigningOut(true)
    // Use callbackUrl to force a full page reload and clear session
    await signOut({ callbackUrl: '/login' })
  }

  if (!session?.user) return null

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="font-semibold text-gray-900 mr-4 text-sm tracking-tight flex-shrink-0">
          Agency Ops
        </span>
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto scrollbar-hide">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                path === l.href || (l.href !== '/' && path.startsWith(l.href))
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <NotificationBell />

          {/* User Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
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

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/account"
                      onClick={() => setDropdownOpen(false)}
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
                        setDropdownOpen(false)
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
