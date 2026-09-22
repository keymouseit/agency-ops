import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import {
  getSalesRobotSyncStatus,
  startSalesRobotSync,
} from '@/lib/salesrobot/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const ROLES = ['Founder', 'Manager', 'BD', 'Both'] as const

/** Poll background sync status (running / done / last sync time). */
export async function GET() {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  return NextResponse.json(getSalesRobotSyncStatus())
}

/** Start sync in the background — returns immediately so the UI can navigate away. */
export async function POST(request: Request) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  let body: { daysBack?: number; syncProspects?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const { started, status } = startSalesRobotSync({
    daysBack: typeof body.daysBack === 'number' ? body.daysBack : 42,
    syncProspects: Boolean(body.syncProspects),
  })

  return NextResponse.json(
    {
      started,
      background: true,
      ...status,
    },
    { status: started || status.state === 'running' ? 202 : 409 }
  )
}
