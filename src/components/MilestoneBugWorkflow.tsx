'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import { BUG_STATUS_CONFIG } from '@/lib/milestone-qa'

type BugLike = {
  id: string
  status: string
  resolutionNotes?: string | null
}

/**
 * Role-aware actions on a milestone bug:
 * - Dev: Move open bugs to QA (status → fixed) with notes
 * - QA: verify (closed) or reopen fixed bugs
 */
export default function MilestoneBugWorkflow({
  milestoneId,
  bug,
  canFix = false,
  canReview = false,
}: {
  milestoneId: string
  bug: BugLike
  canFix?: boolean
  canReview?: boolean
}) {
  const router = useRouter()
  const [mode, setMode] = useState<'idle' | 'fix' | 'reopen'>('idle')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function patch(body: Record<string, string>) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs/${bug.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data.error === 'string' && data.error.trim()
            ? data.error
            : `Could not update bug (${res.status})`
        )
      }
      setMode('idle')
      setNotes('')
      softRefresh(router)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  const showDevMove = canFix && bug.status === 'open'
  const showQaOnFixed = canReview && bug.status === 'fixed'
  const showQaOnClosed = canReview && bug.status === 'closed'

  if (!showDevMove && !showQaOnFixed && !showQaOnClosed && !bug.resolutionNotes) {
    return null
  }

  return (
    <div className="mt-2 space-y-2">
      {bug.resolutionNotes && bug.status !== 'open' && (
        <p className="text-[11px] text-gray-500 whitespace-pre-wrap">
          <span className="font-medium text-gray-600">Dev fix notes: </span>
          {bug.resolutionNotes}
        </p>
      )}

      {showDevMove && mode !== 'fix' && (
        <button
          type="button"
          className="btn-secondary text-xs py-1 px-2.5"
          onClick={() => {
            setMode('fix')
            setNotes('')
            setError('')
          }}
        >
          Move to QA
        </button>
      )}

      {showDevMove && mode === 'fix' && (
        <div className="space-y-2 rounded-md border border-emerald-100 bg-white/70 p-2">
          <p className="text-[11px] text-gray-500">
            Describe what you fixed. QA will see this as{' '}
            <span className={`badge text-[10px] ${BUG_STATUS_CONFIG.fixed.cls}`}>Fixed</span> and can
            verify or reopen.
          </p>
          <textarea
            rows={2}
            className="input text-xs"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What did you change? (required)"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs py-1 px-2.5"
              disabled={loading || !notes.trim()}
              onClick={() => patch({ status: 'fixed', resolutionNotes: notes.trim() })}
            >
              {loading ? 'Sending…' : 'Send to QA'}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs py-1 px-2.5"
              disabled={loading}
              onClick={() => setMode('idle')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showQaOnFixed && mode !== 'reopen' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-xs py-1 px-2.5"
            disabled={loading}
            onClick={() => patch({ status: 'closed' })}
          >
            {loading ? 'Saving…' : 'Mark verified'}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs py-1 px-2.5"
            disabled={loading}
            onClick={() => {
              setMode('reopen')
              setNotes('')
              setError('')
            }}
          >
            Reopen
          </button>
        </div>
      )}

      {showQaOnClosed && (
        <button
          type="button"
          className="btn-secondary text-xs py-1 px-2.5"
          disabled={loading}
          onClick={() => {
            setMode('reopen')
            setNotes('')
            setError('')
          }}
        >
          Reopen
        </button>
      )}

      {mode === 'reopen' && (showQaOnFixed || showQaOnClosed) && (
        <div className="space-y-2 rounded-md border border-amber-100 bg-white/70 p-2">
          <textarea
            rows={2}
            className="input text-xs"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Why reopen? (optional)"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs py-1 px-2.5"
              disabled={loading}
              onClick={() =>
                patch({
                  status: 'open',
                  ...(notes.trim() ? { resolutionNotes: notes.trim() } : { resolutionNotes: '' }),
                })
              }
            >
              {loading ? 'Reopening…' : 'Confirm reopen'}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs py-1 px-2.5"
              disabled={loading}
              onClick={() => setMode('idle')}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
    </div>
  )
}
