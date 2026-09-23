'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MOM_FINAL_STATUSES } from '@/lib/utils'

/** Explicit colors so the closed <select> paints a full field fill + soft border
 *  (Tailwind bg/border classes are often ignored on native selects). */
const STATUS_TONES: Record<string, { bg: string; text: string; border: string }> = {
  Active: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  'Waiting Response': { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  'Demo Given / Committed / Prepared': { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
  Hold: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  Closed: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' },
}

const FALLBACK_TONE = { bg: '#f9fafb', text: '#1f2937', border: '#e5e7eb' }

export default function MomFinalStatusControl({
  id,
  status,
}: {
  id: string
  status: string
}) {
  const [value, setValue] = useState(status || 'Active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function onChange(next: string) {
    if (next === value) return
    const previous = value
    setValue(next)
    setLoading(true)
    setError('')

    const res = await fetch(`/api/mom/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalStatus: next }),
    })

    setLoading(false)
    if (!res.ok) {
      setValue(previous)
      const data = await res.json().catch(() => ({}))
      setError(
        typeof data.error === 'string' && data.error.trim()
          ? data.error
          : `Could not update status (${res.status}). Refresh and try again.`
      )
      return
    }

    router.refresh()
  }

  const tone = STATUS_TONES[value] ?? FALLBACK_TONE

  return (
    <div className="relative inline-flex">
      <select
        value={value}
        disabled={loading}
        onChange={e => onChange(e.target.value)}
        style={{
          backgroundColor: tone.bg,
          color: tone.text,
          borderColor: tone.border,
        }}
        className="appearance-none inline-flex items-center h-[30px] max-w-[16rem] pl-2.5 pr-8 text-xs font-semibold rounded-lg border border-solid cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
        aria-label="Update final status"
      >
        {MOM_FINAL_STATUSES.map(s => (
          <option key={s} value={s} style={{ backgroundColor: '#ffffff', color: '#111827' }}>
            {s}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] leading-none opacity-70"
        style={{ color: tone.text }}
      >
        ▼
      </span>
      {error && (
        <p className="absolute right-0 top-full mt-1 text-[11px] text-red-700 whitespace-nowrap">{error}</p>
      )}
    </div>
  )
}
