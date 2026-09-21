'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function SalesRobotSyncButton({
  canSync,
  lastSyncedAt,
}: {
  canSync: boolean
  lastSyncedAt?: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function sync(syncProspects: boolean) {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations/salesrobot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 42, syncProspects }),
      })
      const data = await res.json()
      if (!res.ok && !data.configured) {
        toast.error(data.errors?.[0] || 'SalesRobot is not configured')
        return
      }
      if (data.errors?.length) {
        toast.error(`Synced with ${data.errors.length} error(s). Check server logs.`)
      } else {
        toast.success(
          `Synced ${data.campaigns} campaigns · ${data.dailyRows} daily rows · ${data.weeksRebuilt} weeks`
        )
      }
      router.refresh()
    } catch {
      toast.error('Sync failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch sm:items-end gap-2 min-w-[200px]">
      {canSync && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => sync(false)}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60"
          >
            {loading ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => sync(true)}
            className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-60"
            title="Also pull prospect lists (slower)"
          >
            Full sync
          </button>
        </div>
      )}
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-right">
        <div className="text-[10px] uppercase tracking-wide text-gray-400">Last sync</div>
        <div className="text-xs font-medium text-gray-800 mt-0.5">
          {lastSyncedAt || 'Never'}
        </div>
      </div>
    </div>
  )
}
