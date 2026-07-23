'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import { BUG_SEVERITY_CONFIG, SerializedBug } from '@/lib/milestone-qa'

export default function MilestoneBugFixActions({
  milestoneId,
  bugs,
}: {
  milestoneId: string
  bugs: SerializedBug[]
}) {
  const router = useRouter()
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const openBugs = bugs.filter(b => b.status === 'open')
  if (openBugs.length === 0) return null

  async function submitFix(bugId: string) {
    if (!resolutionNotes.trim()) return
    setLoading(bugId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs/${bugId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'fixed', resolutionNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit fix')
      setFixingId(null)
      setResolutionNotes('')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit fix')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Your fixes needed
      </h4>
      <div className="space-y-2">
        {openBugs.map(bug => {
          const severityCfg = BUG_SEVERITY_CONFIG[bug.severity] ?? BUG_SEVERITY_CONFIG.medium
          const isFixing = fixingId === bug.id

          return (
            <div key={bug.id} className="rounded-lg px-2.5 py-2 text-xs bg-red-50 border border-red-100">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`badge shrink-0 ${severityCfg.cls}`}>{severityCfg.label}</span>
                <div className="flex-1 min-w-0 font-medium text-gray-800">{bug.title}</div>
              </div>
              {bug.description && (
                <p className="text-gray-600 mt-1 whitespace-pre-wrap">{bug.description}</p>
              )}

              {!isFixing ? (
                <button
                  type="button"
                  className="btn-secondary text-xs mt-2 py-1 px-2"
                  onClick={() => {
                    setFixingId(bug.id)
                    setResolutionNotes('')
                  }}
                >
                  Mark as fixed
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    className="input text-xs"
                    value={resolutionNotes}
                    onChange={e => setResolutionNotes(e.target.value)}
                    placeholder="What did you fix? (required)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs py-1 px-2"
                      disabled={loading === bug.id || !resolutionNotes.trim()}
                      onClick={() => submitFix(bug.id)}
                    >
                      {loading === bug.id ? 'Saving...' : 'Submit fix to QA'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() => setFixingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
