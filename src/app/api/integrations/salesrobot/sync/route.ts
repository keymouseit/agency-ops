import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { runSalesRobotSync } from '@/lib/salesrobot'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ROLES = ['Founder', 'Manager', 'BD', 'Both'] as const

export async function POST(request: Request) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  let body: { daysBack?: number; syncProspects?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const result = await runSalesRobotSync({
    daysBack: typeof body.daysBack === 'number' ? body.daysBack : 42,
    syncProspects: Boolean(body.syncProspects),
  })

  return NextResponse.json(result, {
    status: result.ok || result.campaigns > 0 || result.dailyRows > 0 ? 200 : 502,
  })
}
