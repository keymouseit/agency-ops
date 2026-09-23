'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { fmtDateTime } from '@/lib/utils'

type SyncStatus = {
  state: 'idle' | 'running' | 'done' | 'error'
  mode: 'quick' | 'full' | null
  startedAt: string | null
  finishedAt: string | null
  lastSyncedAt: string | null
  message: string | null
  result?: {
    campaigns?: number
    prospects?: number
    dailyRows?: number
    errors?: string[]
  } | null
}

export default function SalesRobotSyncButton({
  canSync,
  lastSyncedAt,
}: {
  canSync: boolean
  lastSyncedAt?: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [starting, setStarting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const seenDoneKey = useRef<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const running = status?.state === 'running' || starting
  const liveSyncTime =
    (status?.lastSyncedAt && fmtDateTime(status.lastSyncedAt)) ||
    (status?.finishedAt && fmtDateTime(status.finishedAt)) ||
    null
  // Prefer server-provided lastSyncedAt until client has polled, to avoid hydration mismatch
  const displayLastSync = mounted && liveSyncTime ? liveSyncTime : lastSyncedAt || 'Never'

  async function fetchStatus(): Promise<SyncStatus | null> {
    try {
      const res = await fetch('/api/integrations/salesrobot/sync', { cache: 'no-store' })
      if (!res.ok) return null
      return (await res.json()) as SyncStatus
    } catch {
      return null
    }
  }

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function poll() {
      const next = await fetchStatus()
      if (cancelled || !next) return
      setStatus(next)
      return next
    }

    void poll().then(next => {
      if (cancelled) return
      if (next?.state === 'running' && !timer) {
        timer = setInterval(() => {
          void poll()
        }, 4000)
      }
    })

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  // Keep polling while a sync is running (including after we just started one)
  useEffect(() => {
    if (status?.state !== 'running') return
    const timer = setInterval(async () => {
      const live = await fetchStatus()
      if (live) setStatus(live)
    }, 4000)
    return () => clearInterval(timer)
  }, [status?.state])

  useEffect(() => {
    if (!status) return
    if (status.state !== 'done' && status.state !== 'error') return
    if (!status.finishedAt) return

    const key = `${status.state}:${status.finishedAt}`
    if (seenDoneKey.current === key) return
    seenDoneKey.current = key

    if (status.state === 'done') {
      const label = status.mode === 'full' ? 'Full sync done' : 'Sync done'
      const r = status.result
      toast.success(
        r
          ? `${label} · ${r.campaigns ?? 0} campaigns · ${r.prospects ?? 0} replies · ${r.dailyRows ?? 0} daily rows`
          : label
      )
      router.refresh()
    } else if (status.message) {
      toast.error(status.message)
    }
  }, [status, router])

  async function clearStuckSync() {
    setStarting(true)
    try {
      const res = await fetch('/api/integrations/salesrobot/sync', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || data.message || 'Could not clear sync')
        return
      }
      setStatus(data)
      toast.success('Stuck sync cleared — you can Sync again')
      router.refresh()
    } catch {
      toast.error('Could not clear sync')
    } finally {
      setStarting(false)
    }
  }

  async function sync(syncProspects: boolean) {
    setStarting(true)
    try {
      const res = await fetch('/api/integrations/salesrobot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 42, syncProspects }),
      })
      const data = await res.json()
      setStatus(data)

      if (res.status === 409 || data.started === false) {
        toast(data.message || 'Sync already running in the background')
        return
      }

      if (data.state === 'error') {
        toast.error(data.message || 'Could not start sync')
        return
      }

      toast.success(
        syncProspects
          ? 'Full sync started in background — you can keep using the app'
          : 'Sync started in background'
      )
    } catch {
      toast.error('Could not start sync')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2 min-w-[220px]">
      {canSync && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={running}
            onClick={() => sync(false)}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
          >
            {running && status?.mode !== 'full' ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => sync(true)}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60"
            title="Deeper inbox pull for client last messages (runs in background)"
          >
            {running && status?.mode === 'full' ? 'Full sync…' : 'Full sync'}
          </button>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-right min-w-[200px]">
        {running ? (
          <>
            <div className="text-[10px] uppercase tracking-wide text-amber-600">
              {status?.mode === 'full' ? 'Full sync running' : 'Sync running'}
            </div>
            <div className="text-xs font-medium text-amber-800 mt-0.5">
              {status?.message || 'Working in background…'}
            </div>
            {status?.startedAt && (
              <div className="text-[11px] text-gray-500 mt-1">
                Started {fmtDateTime(status.startedAt)}
              </div>
            )}
            {canSync && (
              <button
                type="button"
                disabled={starting}
                onClick={() => clearStuckSync()}
                className="mt-2 text-[11px] font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
              >
                Stuck? Clear sync
              </button>
            )}
          </>
        ) : status?.state === 'done' && status.message ? (
          <>
            <div className="text-[10px] uppercase tracking-wide text-emerald-600">
              {status.mode === 'full' ? 'Full sync done' : 'Sync done'}
            </div>
            <div className="text-xs font-medium text-gray-800 mt-0.5">{displayLastSync}</div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Last sync</div>
            <div className="text-xs font-medium text-gray-800 mt-0.5">{displayLastSync}</div>
          </>
        )}
      </div>
    </div>
  )
}
