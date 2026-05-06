import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Agency Ops — KeyMouse IT',
  description: 'Internal operations platform',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <SessionProvider session={session}>
          {/* Only show nav when logged in */}
          {session?.user && <Nav />}
          <main className={session?.user ? 'max-w-7xl mx-auto px-4 py-8' : ''}>
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  )
}
