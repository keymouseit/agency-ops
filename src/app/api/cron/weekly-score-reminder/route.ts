import { NextResponse } from 'next/server'
import { runWeeklyScoreReminder } from '@/lib/weekly-score-reminder'

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
 * Friday 17:00 IST (11:30 UTC) — remind active members who haven't submitted
 * this week's WeeklyScore self-assessment. In-app bell via notify (push follows
 * notify's default when credentials exist). Idempotent per person per week.
 *
 * Do not hit this against a real Neon DB from local unless you intend to write
 * Notification rows.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runWeeklyScoreReminder()
  return NextResponse.json({ ok: true, ...result })
}
