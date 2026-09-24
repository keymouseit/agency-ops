'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MOM_FINAL_STATUSES } from '@/lib/utils'

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

  return (
    <div className="relative inline-flex">
      <select
        value={value}
        disabled={loading}
        onChange={e => onChange(e.target.value)}
        className="appearance-none inline-flex items-center h-[30px] max-w-[16rem] pl-2.5 pr-8 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-800 cursor-pointer disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-300"
        aria-label="Update final status"
      >
        {MOM_FINAL_STATUSES.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] leading-none text-gray-400"
      >
        ▼
      </span>
      {error && (
        <p className="absolute right-0 top-full mt-1 text-[11px] text-red-700 whitespace-nowrap">{error}</p>
      )}
    </div>
  )
}
