import { NextResponse } from 'next/server'
import { runSalesRobotSync } from '@/lib/salesrobot'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    return request.headers.get('authorization') === `Bearer ${secret}`
  }
  const ua = request.headers.get('user-agent') || ''
  return request.headers.get('x-vercel-cron') === '1' || ua.includes('vercel-cron')
}

/** Reconcile SalesRobot campaigns/stats every 6 hours. */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runSalesRobotSync({
    daysBack: 14,
    syncProspects: false,
  })

  return NextResponse.json({ ...result })
}
