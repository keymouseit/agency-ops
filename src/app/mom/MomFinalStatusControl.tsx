'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MOM_FINAL_STATUSES, MOM_FINAL_STATUS_COLORS } from '@/lib/utils'
import SimpleSelect from '@/components/SimpleSelect'

export default function MomFinalStatusControl({
  id,
  status,
  canEdit = true,
}: {
  id: string
  status: string
  /** Founder/Manager can change Deal status; BD sees a read-only badge. */
  canEdit?: boolean
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

    try {
      const res = await fetch(`/api/mom/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalStatus: next }),
      })

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
    } catch {
      setValue(previous)
      setError('Could not update status. Refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  const badgeCls =
    MOM_FINAL_STATUS_COLORS[value] ?? 'bg-gray-100 text-gray-700 border-gray-200'

  return (
    <div className="relative inline-flex flex-col items-stretch sm:items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-medium shrink-0">
          Deal status
        </span>
        {canEdit ? (
          <div className="relative inline-flex items-center gap-1.5">
            {loading && (
              <span
                className="inline-flex items-center gap-1 text-[11px] text-gray-500"
                role="status"
                aria-live="polite"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin"
                  aria-hidden="true"
                />
                Saving…
              </span>
            )}
            <SimpleSelect
              aria-label="Deal status"
              disabled={loading}
              value={value}
              onChange={onChange}
              className="!h-[30px] max-w-[16rem] !py-0 text-xs font-medium"
              options={MOM_FINAL_STATUSES.map(s => ({ value: s, label: s }))}
            />
          </div>
        ) : (
          <span
            className={`inline-flex items-center h-[30px] px-2.5 text-xs font-medium rounded-lg border ${badgeCls}`}
            title="Only Founder or Manager can change Deal status"
          >
            {value}
          </span>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-red-700 whitespace-nowrap sm:text-right">{error}</p>
      )}
    </div>
  )
}
