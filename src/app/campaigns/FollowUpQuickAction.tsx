'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function FollowUpQuickAction({ momId, compact = false }: { momId: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function markDone() {
    setLoading(true)
    setError('')

    const res = await fetch(`/api/mom/${momId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpCompleted: true }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not mark follow-up.')
      return
    }

    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded">
        ✓ Done
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={markDone}
        disabled={loading}
        className={`text-[10px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-100 disabled:opacity-60 rounded px-1.5 py-0.5 transition-colors ${compact ? '' : ''}`}
      >
        {loading ? '…' : 'Mark follow-up done'}
      </button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  )
}
