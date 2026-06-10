import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

// ── Role-based page access ────────────────────────────────────────────────────
export const ROLE_ACCESS: Record<string, string[]> = {
  Founder: ['/', '/account', '/intelligence', '/pipeline', '/projects', '/qa', '/team', '/checkin', '/daily', '/analytics', '/goals', '/estimate'],
  BD:      ['/me', '/account', '/pipeline', '/projects', '/checkin', '/daily', '/estimate'],
  Dev:     ['/me', '/account', '/projects', '/checkin', '/daily', '/estimate'],
  QA:      ['/me', '/account', '/qa', '/checkin', '/daily'],
  Both:    ['/me', '/account', '/pipeline', '/projects', '/checkin', '/daily', '/estimate'],
}

// ── Auth export (defined first so helpers can call auth()) ────────────────────
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[AUTH] Login attempt:', { email: credentials?.email })

        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials')
          return null
        }

        const account = await prisma.userAccount.findFirst({
          where: { member: { email: credentials.email as string } },
          include: { member: true },
        })

        if (!account) {
          console.log('[AUTH] Account not found for email:', credentials.email)
          return null
        }

        console.log('[AUTH] Account found, checking password...')
        const valid = await bcrypt.compare(
          credentials.password as string,
          account.passwordHash
        )

        if (!valid) {
          console.log('[AUTH] Invalid password for:', credentials.email)
          return null
        }

        console.log('[AUTH] Login successful for:', credentials.email)
        await prisma.userAccount.update({
          where: { id: account.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id:    account.member.id,
          email: account.member.email,
          name:  account.member.name,
          role:  account.member.role,
          image: null,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id   = user.id ?? ''
        token.role = (user as { role: string }).role
        token.name = user.name ?? ''
        token.email = user.email ?? ''
      }
      // Handle session updates (e.g., when profile is updated)
      if (trigger === 'update' && session) {
        token.name = session.name as string
        token.email = session.email as string
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id   = token.id as string
        session.user.role = token.role as string
        session.user.name = token.name as string
        session.user.email = token.email as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  session: { strategy: 'jwt' },
  // REQUIRED: app will not start without NEXTAUTH_SECRET in .env
  // Generate: openssl rand -base64 32
  secret: process.env.NEXTAUTH_SECRET,
})

// ── API auth helpers ──────────────────────────────────────────────────────────

/**
 * requireRole — use inside API route handlers to verify the session
 * and that the user's role is in the allowed list.
 * Throws with status 401 (not logged in) or 403 (wrong role).
 */
export async function requireRole(
  allowed: string[]
): Promise<{ memberId: string; role: string }> {
  const session = await auth()
  if (!session?.user?.id) {
    throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 })
  }
  if (!allowed.includes(session.user.role)) {
    throw Object.assign(new Error('FORBIDDEN'), { status: 403 })
  }
  return { memberId: session.user.id, role: session.user.role }
}

/**
 * checkRole — convenience wrapper for API routes.
 * Returns a NextResponse (401/403) if the check fails, or null if it passes.
 *
 * Usage at the top of any route handler:
 *   const deny = await checkRole(['BD', 'Founder'])
 *   if (deny) return deny
 */
export async function checkRole(allowed: string[]): Promise<NextResponse | null> {
  try {
    await requireRole(allowed)
    return null
  } catch (e: unknown) {
    const err = e as { message: string; status?: number }
    const isUnauthed = err.message === 'UNAUTHORIZED'
    return NextResponse.json(
      { error: isUnauthed ? 'Sign in required.' : 'You do not have permission for this action.' },
      { status: isUnauthed ? 401 : 403 }
    )
  }
}

// ── Type augmentation ─────────────────────────────────────────────────────────
declare module 'next-auth' {
  interface User { role: string }
  interface Session {
    user: {
      id: string
      role: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
declare module '@auth/core/jwt' {
  interface JWT { id: string; role: string }
}
