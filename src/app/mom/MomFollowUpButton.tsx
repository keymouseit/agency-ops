'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'

export default function MomFollowUpButton({
  id,
  followUpDate,
  completedAt,
}: {
  id: string
  followUpDate: string
  completedAt: string | null
}) {
  const [done, setDone] = useState(!!completedAt)
  const [completedOn, setCompletedOn] = useState(completedAt)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function markCompleted() {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/mom/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpCompleted: true }),
    })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not mark as completed.')
      return
    }

    const data = await res.json()
    setDone(true)
    setCompletedOn(data.followUpCompletedAt)
    router.refresh()
  }

  if (done) {
    return (
      <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 text-green-800 border border-green-100">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">
          ✓
        </span>
        <div>
          <div className="text-sm font-medium">Follow-up attended</div>
          {completedOn && (
            <div className="text-xs text-green-700/80 mt-0.5">
              Marked complete on {fmtDate(new Date(completedOn))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={markCompleted}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 transition-colors"
      >
        {loading ? 'Saving…' : 'Mark follow-up as attended'}
      </button>
      <p className="text-xs text-gray-400 mt-1.5">
        Scheduled for {fmtDate(new Date(followUpDate))} — mark done once the call happens so it won&apos;t show as overdue.
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
