import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { deriveInitials, getBranding, upsertBranding } from '@/lib/branding'

export async function GET() {
  const branding = await getBranding()
  return NextResponse.json(branding)
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'Founder') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const tagline = typeof body.tagline === 'string' ? body.tagline.trim() : ''
  const initials =
    typeof body.initials === 'string' && body.initials.trim()
      ? body.initials.trim().slice(0, 3).toUpperCase()
      : deriveInitials(name)

  if (!name) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }

  try {
    const branding = await upsertBranding({
      name,
      initials,
      tagline: tagline || 'Internal operations platform',
    })
    return NextResponse.json({
      name: branding.name,
      initials: branding.initials,
      tagline: branding.tagline,
    })
  } catch (error) {
    console.error('Branding update error:', error)
    return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 })
  }
}
