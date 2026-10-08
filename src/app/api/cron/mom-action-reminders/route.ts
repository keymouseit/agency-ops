import { NextResponse } from 'next/server'
import { runMomActionReminders } from '@/lib/mom-action-reminders'
import { runFounderDigest } from '@/lib/founder-digest'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  const ua = request.headers.get('user-agent') || ''
  return request.headers.get('x-vercel-cron') === '1' || ua.includes('vercel-cron')
}

/**
 * Daily (08:30 IST) MOM action due / overdue / escalation nudges,
 * followed by the Founder / Manager morning digest (in-app bell only).
 *
 * `?only=digest` runs just the digest (handy for local QA without re-nudging owners).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const only = new URL(request.url).searchParams.get('only')
  const result = only === 'digest' ? null : await runMomActionReminders()

  let digest: Awaited<ReturnType<typeof runFounderDigest>> | { error: string }
  try {
    digest = await runFounderDigest()
  } catch (err) {
    // Never let the digest break the reminder cron.
    logger.error('Founder digest crashed', err as Error)
    digest = { error: 'digest_failed' }
  }

  return NextResponse.json({ ok: true, ...(result ?? {}), digest })
}
