import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { checkRole } from '@/lib/auth'
import {
  clearSalesRobotSyncLock,
  getSalesRobotSyncStatus,
  startSalesRobotSync,
} from '@/lib/salesrobot/sync'

export const dynamic = 'force-dynamic'
/** Pro can use up to 300s; Hobby is capped (~60s). Sync self-budgets for Vercel. */
export const maxDuration = 60

const ROLES = ['Founder', 'Manager', 'BD', 'Both'] as const

/** Poll background sync status (running / done / last sync time). Stale locks auto-clear. */
export async function GET() {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  return NextResponse.json(await getSalesRobotSyncStatus())
}

/** Force-clear a stuck "running" lock (Vercel often kills long waitUntil jobs). */
export async function DELETE() {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  const status = await clearSalesRobotSyncLock(
    'Stuck sync cleared. You can start Sync again.'
  )
  return NextResponse.json(status)
}

/**
 * Start sync in the background — returns immediately so the UI can navigate away.
 * Uses waitUntil so Vercel keeps the function alive until sync finishes.
 * Pass { force: true } to clear a stuck lock before starting.
 */
export async function POST(request: Request) {
  const deny = await checkRole([...ROLES])
  if (deny) return deny

  let body: { daysBack?: number; syncProspects?: boolean; force?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.force) {
    await clearSalesRobotSyncLock('Previous sync cleared before restart')
  }

  const { started, status, promise } = await startSalesRobotSync({
    daysBack: typeof body.daysBack === 'number' ? body.daysBack : 42,
    syncProspects: Boolean(body.syncProspects),
  })

  if (started && promise) {
    waitUntil(
      promise.catch(err => {
        console.error('[salesrobot] background sync failed', err)
      })
    )
  }

  return NextResponse.json(
    {
      started,
      background: true,
      ...status,
    },
    { status: started || status.state === 'running' ? 202 : 409 }
  )
}
