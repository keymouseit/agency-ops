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
  { href: '/pipeline',     label: 'BD Pipeline', roles: ['Founder','BD','Both'] },
  { href: '/estimate',     label: 'Estimates',   roles: ['Founder','BD','Both','Dev'] },
  { href: '/projects',     label: 'Projects',    roles: ['Founder','Dev','Both'] },
  { href: '/qa',           label: 'QA',          roles: ['Founder','QA'] },
  { href: '/team',         label: 'Team Scores', roles: ['Founder'] },
  { href: '/checkin',      label: 'Check-In',    roles: ['Founder','BD','Dev','QA','Both'] },
  { href: '/daily',        label: 'Daily',       roles: ['Founder','BD','Dev','QA','Both'] },
  { href: '/analytics',    label: 'Analytics',   roles: ['Founder'] },
  { href: '/goals',        label: 'Goals',       roles: ['Founder'] },
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
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
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
          <span className="text-sm text-gray-700 font-medium hidden sm:block">{firstName}</span>
          {role && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600'}`}>
              {role}
            </span>
          )}
          <button onClick={handleSignOut} disabled={signingOut}
            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
            {signingOut ? '…' : 'Sign out'}
          </button>
        </div>
      </div>
    </nav>
  )
}
