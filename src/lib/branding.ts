import { unstable_cache, revalidateTag } from 'next/cache'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS } from '@/lib/cache-tags'

export type Branding = {
  name: string
  initials: string
  tagline: string
}

export const DEFAULT_BRANDING: Branding = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME ?? 'KeyMouse IT',
  initials: process.env.NEXT_PUBLIC_COMPANY_INITIALS ?? 'KI',
  tagline: process.env.NEXT_PUBLIC_COMPANY_TAGLINE ?? 'Internal operations platform',
}

export function deriveInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return 'KI'
}

const fetchBrandingCached = unstable_cache(
  async (): Promise<Branding> => {
    const row = await prisma.companyBranding.findUnique({ where: { id: 'default' } })
    if (row) {
      return {
        name: row.name,
        initials: row.initials,
        tagline: row.tagline,
      }
    }
    return DEFAULT_BRANDING
  },
  ['company-branding-v1'],
  { revalidate: 300, tags: [CACHE_TAGS.branding] },
)

/** Request-deduped + cross-request cached branding (5 min TTL). */
export const getBranding = cache(async (): Promise<Branding> => {
  try {
    return await fetchBrandingCached()
  } catch {
    return DEFAULT_BRANDING
  }
})

export async function upsertBranding(data: Branding) {
  const row = await prisma.companyBranding.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  })
  revalidateTag(CACHE_TAGS.branding)
  return row
}
