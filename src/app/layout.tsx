import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import { NavigationProvider } from '@/components/NavigationProvider'
import { SessionProvider } from 'next-auth/react'
import AppToaster from '@/components/AppToaster'
import PwaRegister from '@/components/PwaRegister'
import { auth } from '@/lib/auth'
import { getBranding } from '@/lib/branding'

export const viewport: Viewport = {
  themeColor: '#f9fafb',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding()
  return {
    title: branding.name,
    description: branding.tagline,
    applicationName: 'Agency Ops',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Agency Ops',
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: [
        { url: '/favicon.png?v=3', type: 'image/png' },
        { url: '/favicon.ico?v=3', type: 'image/x-icon' },
        { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
      shortcut: '/favicon.ico?v=3',
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, branding] = await Promise.all([auth(), getBranding()])

  return (
    <html lang="en" className="light" style={{ colorScheme: 'light' }}>
      <body className="bg-gray-50 min-h-screen text-gray-900" style={{ colorScheme: 'light' }}>
        <SessionProvider session={session}>
          <AppToaster />
          <PwaRegister />
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
            <main className={session?.user ? 'app-main px-3 py-5 sm:px-4 sm:py-8' : ''}>
              {children}
            </main>
          </NavigationProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
