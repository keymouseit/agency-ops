'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_COLORS } from '@/lib/campaigns'

const STATUS_DOT: Record<string, string> = {
  draft: 'bg-gray-400',
  active: 'bg-green-500',
  paused: 'bg-amber-500',
  completed: 'bg-blue-500',
}

export default function CampaignStatusSelect({
  campaignId,
  currentStatus,
}: {
  campaignId: string
  currentStatus: string
}) {
  const [status, setStatus] = useState(currentStatus)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    setStatus(currentStatus)
  }, [currentStatus])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function pick(next: string) {
    setOpen(false)
    if (next === status) return
    setLoading(true)
    setError('')

    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })

    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not update status.')
      return
    }

    setStatus(next)
    router.refresh()
  }

  return (
    <div ref={ref} className="relative inline-flex flex-col">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen(v => !v)}
        className={`badge border capitalize inline-flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-60 ${CAMPAIGN_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {loading ? 'Saving…' : status}
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute top-full left-0 mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[8.5rem]"
        >
          {CAMPAIGN_STATUSES.map(s => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === status}
              onClick={() => pick(s)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs capitalize text-left hover:bg-gray-50 ${
                s === status ? 'font-semibold text-gray-900 bg-gray-50/80' : 'text-gray-600'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
              {s}
            </button>
          ))}
        </div>
      )}

      {error && <p className="absolute top-full left-0 mt-1 text-[10px] text-red-600 whitespace-nowrap">{error}</p>}
    </div>
  )
}
