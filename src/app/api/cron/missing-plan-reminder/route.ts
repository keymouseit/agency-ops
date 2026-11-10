import { NextResponse } from 'next/server'
import { runMissingPlanReminder } from '@/lib/missing-plan-reminder'
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
 * Mon–Fri 15:00 IST (09:30 UTC) — post ONE Slack message in #general mentioning
 * active members with no morning plan today (same list as Daily ops "NO MORNING PLAN",
 * minus attendanceExcluded). Skips weekends, national/public holidays from the Holiday
 * table (returns { skipped: 'holiday', holidayName }), and empty lists. If the Holiday table
 * can't be read it posts nothing (skipped: 'holiday_check_failed'). Floating holidays don't skip.
 *
 * `?dryRun=1` returns the computed list + message text without posting.
 * `?dryRun=1&date=YYYY-MM-DD` previews another IST day (dry-run only).
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = new URL(request.url).searchParams
  const dryRun = params.get('dryRun') === '1' || params.get('dryRun') === 'true'
  const date = params.get('date')
  const now =
    dryRun && date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T15:00:00+05:30`) : new Date()

  try {
    const result = await runMissingPlanReminder({ dryRun, now })
    return NextResponse.json(result, { status: result.ok ? 200 : 502 })
  } catch (err) {
    logger.error('missing-plan-reminder crashed', err as Error)
    return NextResponse.json({ ok: false, error: 'reminder_failed' }, { status: 500 })
  }
}
