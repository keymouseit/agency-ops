'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROJECT_STATUS_LABELS } from '@/lib/utils'

export default function QAReturnToDev({
  projectId,
  projectStatus,
}: {
  projectId: string
  projectStatus: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'active' | 'on_hold'>('active')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (projectStatus !== 'qa') return null

  async function submit() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to update status')
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shrink-0">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-secondary text-xs"
        >
          Move back to Active →
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 min-w-[240px]">
          <p className="text-xs text-amber-900 font-medium mb-2">
            Send project back to development
          </p>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as 'active' | 'on_hold')}
            className="input text-xs mb-2"
          >
            <option value="active">{PROJECT_STATUS_LABELS.active} (in progress)</option>
            <option value="on_hold">{PROJECT_STATUS_LABELS.on_hold}</option>
          </select>
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={submit}
              className="btn-primary text-xs py-1.5 px-3"
            >
              {loading ? 'Updating…' : 'Confirm'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => { setOpen(false); setError('') }}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
