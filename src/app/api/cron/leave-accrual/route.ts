import { NextResponse } from 'next/server'
import { accrueMonthlyLeaveForAllActive } from '@/lib/leave-balance'

export const dynamic = 'force-dynamic'

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  const ua = request.headers.get('user-agent') || ''
  return request.headers.get('x-vercel-cron') === '1' || ua.includes('vercel-cron')
}

/** Runs daily at 00:00 IST; +1 leave day is applied on the 1st of each month. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await accrueMonthlyLeaveForAllActive()
  return NextResponse.json({ ok: true, ...result })
}
