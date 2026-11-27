'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import { fmtDate } from '@/lib/utils'
import { BUG_SEVERITY_CONFIG, SerializedBug, SerializedTestCase } from '@/lib/milestone-qa'

export default function MilestoneBugFixActions({
  milestoneId,
  bugs,
  testCases = [],
}: {
  milestoneId: string
  bugs: SerializedBug[]
  testCases?: SerializedTestCase[]
}) {
  const router = useRouter()
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  const openBugs = bugs.filter(b => b.status === 'open')
  if (openBugs.length === 0) return null

  const caseById = new Map(testCases.map(tc => [tc.id, tc]))

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
      softRefresh(router)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit fix')
    } finally {
      setLoading(null)
    }
  }

  // Group open bugs under their test case for clearer developer view
  const grouped = new Map<string, SerializedBug[]>()
  const orphans: SerializedBug[] = []
  for (const bug of openBugs) {
    if (bug.testCaseId && caseById.has(bug.testCaseId)) {
      const list = grouped.get(bug.testCaseId) ?? []
      list.push(bug)
      grouped.set(bug.testCaseId, list)
    } else {
      orphans.push(bug)
    }
  }

  function renderBug(bug: SerializedBug) {
    const severityCfg = BUG_SEVERITY_CONFIG[bug.severity] ?? BUG_SEVERITY_CONFIG.medium
    const isFixing = fixingId === bug.id

    return (
      <div key={bug.id} className="rounded-lg px-2.5 py-2 text-xs bg-red-50 border border-red-100">
        <div className="flex items-start gap-2 flex-wrap">
          {bug.displayId && (
            <span className="font-mono text-[10px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
              {bug.displayId}
            </span>
          )}
          <span className={`badge shrink-0 ${severityCfg.cls}`}>{severityCfg.label}</span>
          <div className="flex-1 min-w-0 font-medium text-gray-800">{bug.title}</div>
        </div>
        {bug.stepsToReproduce && (
          <p className="text-gray-600 mt-1 whitespace-pre-wrap">
            <span className="font-medium text-gray-700">Steps: </span>
            {bug.stepsToReproduce}
          </p>
        )}
        {bug.description && (
          <p className="text-gray-600 mt-1 whitespace-pre-wrap">{bug.description}</p>
        )}
        {(bug.attachmentUrls?.length ? bug.attachmentUrls : bug.attachmentUrl ? [bug.attachmentUrl] : []).map((url, i, arr) => (
          <a
            key={`${bug.id}-att-${i}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-700 hover:underline mt-1 block"
          >
            {arr.length > 1 ? `Link ${i + 1}` : 'View attachment'}
          </a>
        ))}
        <p className="text-gray-400 mt-1">
          {bug.reportedBy.name} · {fmtDate(bug.reportedAt)}
        </p>

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
                {loading === bug.id ? 'Saving...' : 'Send to QA'}
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
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Your fixes needed
      </h4>
      <div className="space-y-3">
        {[...grouped.entries()].map(([caseId, caseBugs]) => {
          const tc = caseById.get(caseId)
          return (
            <div key={caseId}>
              <div className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-600">
                {tc?.displayId && (
                  <span className="font-mono text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded">
                    {tc.displayId}
                  </span>
                )}
                <span className="font-medium">{tc?.title ?? 'Test case'}</span>
              </div>
              <div className="space-y-2 pl-2 border-l-2 border-red-200">
                {caseBugs.map(renderBug)}
              </div>
            </div>
          )
        })}
        {orphans.length > 0 && (
          <div className="space-y-2">
            {orphans.map(renderBug)}
          </div>
        )}
      </div>
    </div>
  )
}
