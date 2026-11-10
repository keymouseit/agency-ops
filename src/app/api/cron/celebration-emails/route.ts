import { NextResponse } from 'next/server'
import { CELEBRATION_KINDS, isCelebrationKind, runCelebrationEmails } from '@/lib/celebration-emails'
import { parseIstDateKey } from '@/lib/employee-dates'
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
 * Daily (04:00 UTC ≈ 9:30 IST) celebration emails (birthdays + work anniversaries)
 * to all active employees, sent from the company "allkmit" mailbox (CELEBRATION_SMTP_*).
 *
 * `?dryRun=1`                 → who is celebrating today + recipient count; sends/writes nothing.
 * `?dryRun=1&date=YYYY-MM-DD` → same, pretending today (IST) is that date.
 * `&kind=birthday|work_anniversary` → only that kind.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const dryRunParam = params.get('dryRun')
  const dryRun = dryRunParam === '1' || dryRunParam === 'true'
  const dateParam = params.get('date')
  const kindParam = params.get('kind')

  let today: Date | undefined
  if (dateParam) {
    if (!dryRun) {
      return NextResponse.json({ error: '`date` is only allowed together with dryRun=1' }, { status: 400 })
    }
    const parsed = parseIstDateKey(dateParam)
    if (!parsed) {
      return NextResponse.json({ error: '`date` must be a valid YYYY-MM-DD' }, { status: 400 })
    }
    today = parsed
  }

  if (kindParam && !isCelebrationKind(kindParam)) {
    return NextResponse.json(
      { error: `\`kind\` must be one of: ${CELEBRATION_KINDS.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const result = await runCelebrationEmails({
      today,
      dryRun,
      kinds: kindParam && isCelebrationKind(kindParam) ? [kindParam] : undefined,
    })
    return NextResponse.json(result)
  } catch (err) {
    logger.error('Celebration email cron crashed', err as Error)
    return NextResponse.json({ ok: false, error: 'celebration_cron_failed' }, { status: 500 })
  }
}
