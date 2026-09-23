import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import { NavigationProvider } from '@/components/NavigationProvider'
import { SessionProvider } from 'next-auth/react'
import { auth } from '@/lib/auth'
import { getBranding } from '@/lib/branding'

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding()
  return {
    title: branding.name,
    description: branding.tagline,
    icons: {
      icon: [
        { url: '/favicon.png?v=3', type: 'image/png' },
        { url: '/favicon.ico?v=3', type: 'image/x-icon' },
      ],
      shortcut: '/favicon.ico?v=3',
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, branding] = await Promise.all([auth(), getBranding()])

  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <SessionProvider session={session}>
          <NavigationProvider>
            <Nav
              branding={branding}
              initialUser={
                session?.user
                  ? {
                      name: session.user.name ?? '',
                      email: session.user.email ?? '',
                      role: session.user.role ?? '',
                    }
                  : null
              }
            />
            <main className={session?.user ? 'app-main px-4 py-8' : ''}>
              {children}
            </main>
          </NavigationProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
