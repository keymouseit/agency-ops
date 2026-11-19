'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Props = {
  callId: string
  status: string
  momId: string | null
  compact?: boolean
}

export default function CallActions({ callId, status, momId, compact = false }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  async function updateStatus(newStatus: string) {
    setLoading(newStatus)
    setError('')

    const res = await fetch(`/api/campaigns/calls/${callId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    setLoading(null)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not update call.')
      return
    }

    router.refresh()
  }

  const primary =
    'inline-flex items-center justify-center gap-0.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60'
  const ghost =
    'text-[11px] font-medium px-1.5 py-1 rounded-md transition-colors disabled:opacity-60'

  if (status === 'scheduled') {
    return (
      <div className={compact ? 'w-full space-y-1' : 'flex flex-col items-end gap-2 w-full max-w-[13rem]'}>
        <div className="grid grid-cols-2 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => updateStatus('completed')}
            disabled={!!loading}
            className={`${primary} text-white bg-green-600 hover:bg-green-700`}
          >
            {loading === 'completed' ? '…' : 'Complete'}
          </button>
          <Link
            href={`/mom/new?callId=${callId}`}
            className={`${primary} text-blue-700 bg-blue-50 hover:bg-blue-100`}
          >
            Log MOM
          </Link>
          <button
            type="button"
            onClick={() => updateStatus('no_show')}
            disabled={!!loading}
            className={`${ghost} text-red-600 hover:bg-red-50 text-center`}
          >
            {loading === 'no_show' ? '…' : 'No show'}
          </button>
          <button
            type="button"
            onClick={() => updateStatus('cancelled')}
            disabled={!!loading}
            className={`${ghost} text-gray-500 hover:bg-gray-100 text-center`}
          >
            {loading === 'cancelled' ? '…' : 'Cancel'}
          </button>
        </div>
        {error && <p className="text-[10px] text-red-600 text-center">{error}</p>}
      </div>
    )
  }

  if (status === 'completed' && !momId) {
    return (
      <div className={compact ? 'w-full' : 'flex justify-end'}>
        <Link
          href={`/mom/new?callId=${callId}`}
          className={`${primary} w-full text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100`}
        >
          Log MOM →
        </Link>
        {error && <p className="text-[10px] text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  if (momId) {
    return (
      <Link
        href={`/mom/${momId}`}
        className={`${primary} text-violet-700 bg-violet-50 hover:bg-violet-100 ${compact ? 'w-full' : ''}`}
      >
        View MOM →
      </Link>
    )
  }

  if (status === 'no_show' || status === 'cancelled') {
    return (
      <button
        type="button"
        onClick={() => updateStatus('scheduled')}
        disabled={!!loading}
        className={`${primary} text-blue-700 bg-blue-50 hover:bg-blue-100 ${compact ? 'w-full' : ''}`}
      >
        {loading === 'scheduled' ? '…' : 'Reschedule'}
      </button>
    )
  }

  return null
}
