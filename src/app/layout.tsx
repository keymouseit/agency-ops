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
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  const branding = await getBranding()

  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <SessionProvider session={session}>
          <NavigationProvider>
            <Nav branding={branding} />
            <main className={session?.user ? 'app-main px-4 py-8' : ''}>
              {children}
            </main>
          </NavigationProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
