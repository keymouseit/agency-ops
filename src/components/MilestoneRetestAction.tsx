'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'

export default function MilestoneRetestAction({
  milestoneId,
  milestoneStatus,
  hasRetestWork,
  canRequestRetest = false,
}: {
  milestoneId: string
  milestoneStatus: string
  hasRetestWork: boolean
  canRequestRetest?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!canRequestRetest || !hasRetestWork || milestoneStatus !== 'in_progress') {
    return null
  }

  async function sendForRetest() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready_for_qa', requestRetest: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not send milestone to QA')
      softRefresh(router)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send milestone to QA')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-blue-800">
          Fixes are ready. Send this milestone to QA for another test pass.
        </p>
        <button
          type="button"
          data-testid="milestone-send-retest"
          onClick={sendForRetest}
          disabled={loading}
          className="inline-flex items-center rounded-full bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {loading ? 'Sending…' : 'Send to QA for re-test'}
        </button>
      </div>
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  )
}
