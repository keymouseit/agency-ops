import type { MetadataRoute } from 'next'
import { DEFAULT_BRANDING } from '@/lib/branding'

export default function manifest(): MetadataRoute.Manifest {
  const name = DEFAULT_BRANDING.name
  const shortName =
    process.env.NEXT_PUBLIC_COMPANY_INITIALS?.trim() ||
    DEFAULT_BRANDING.initials ||
    'AO'

  return {
    name,
    short_name: shortName,
    description: DEFAULT_BRANDING.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f9fafb',
    theme_color: '#111827',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
