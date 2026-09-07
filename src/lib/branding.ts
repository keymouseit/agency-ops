import { prisma } from '@/lib/prisma'

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

export async function getBranding(): Promise<Branding> {
  try {
    const row = await prisma.companyBranding.findUnique({ where: { id: 'default' } })
    if (row) {
      return {
        name: row.name,
        initials: row.initials,
        tagline: row.tagline,
      }
    }
  } catch {
    // Table may not exist until db push
  }
  return DEFAULT_BRANDING
}

export async function upsertBranding(data: Branding) {
  return prisma.companyBranding.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...data },
    update: data,
  })
}
