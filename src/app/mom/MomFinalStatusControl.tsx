'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MOM_FINAL_STATUSES, MOM_FINAL_STATUS_COLORS } from '@/lib/utils'

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

  const tone = MOM_FINAL_STATUS_COLORS[value] ?? 'bg-gray-50 text-gray-800 border-gray-200'

  return (
    <div className="relative">
      <select
        value={value}
        disabled={loading}
        onChange={e => onChange(e.target.value)}
        className={`inline-flex items-center h-[30px] pl-2.5 pr-7 text-xs font-semibold rounded-lg border cursor-pointer disabled:opacity-60 ${tone}`}
        aria-label="Update final status"
      >
        {MOM_FINAL_STATUSES.map(s => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && (
        <p className="absolute right-0 top-full mt-1 text-[11px] text-red-700 whitespace-nowrap">{error}</p>
      )}
    </div>
  )
}
