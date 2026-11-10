import { NextResponse } from 'next/server'
import { runMomActionReminders } from '@/lib/mom-action-reminders'
import { runFounderDigest } from '@/lib/founder-digest'
import { logger } from '@/lib/logger'
import { checkReminderHoliday, reminderSkipBody } from '@/lib/holidays'
import { istDateInputValue } from '@/lib/ist'

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
 *
 * Both are skipped on national/public holidays from the Holiday table
 * ({ skipped: 'holiday', name }); nothing is sent if the Holiday table can't be
 * read ({ skipped: 'holiday_check_failed' }). Floating holidays don't skip.
 * Overdue nudges resume on the next working day (they are idempotent per ~20h).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dateKey = istDateInputValue()
  const holiday = await checkReminderHoliday(dateKey, 'mom-action-reminders')
  if (holiday.skip) return NextResponse.json(reminderSkipBody(holiday, dateKey))

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
