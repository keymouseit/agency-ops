'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import { TEST_CYCLE_CASE_STATUS_CONFIG, testCycleCaseSummary } from '@/lib/qa'

type Case = {
  id: string
  title: string
  status: string
  notes: string | null
  devFixedAt?: string | null
  devFixNotes?: string | null
  devFixedBy?: { name: string } | null
  qaRetestedAt?: string | null
  qaRetestNotes?: string | null
  qaRetestedBy?: { name: string } | null
}

export default function TestCycleCasesList({
  cases,
  compact = false,
  allowDevFix = false,
  allowQARetest = false,
}: {
  cases: Case[]
  compact?: boolean
  allowDevFix?: boolean
  allowQARetest?: boolean
}) {
  const router = useRouter()
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [retestingId, setRetestingId] = useState<string | null>(null)
  const [fixNotes, setFixNotes] = useState('')
  const [retestNotes, setRetestNotes] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  if (cases.length === 0) return null

  const passed = cases.filter(c => c.status === 'pass' || c.status === 'skipped').length
  const failed = cases.filter(c => c.status === 'fail' || c.status === 'blocked').length
  const summary = testCycleCaseSummary(cases)

  async function submitFix(caseId: string) {
    if (!fixNotes.trim()) return
    setLoading(caseId)
    try {
      const res = await fetch(`/api/qa/cycle-cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to submit fix')
      setFixingId(null)
      setFixNotes('')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit fix')
    } finally {
      setLoading(null)
    }
  }

  async function submitRetest(caseId: string, status: 'pass' | 'fail' | 'blocked') {
    if ((status === 'fail' || status === 'blocked') && !retestNotes.trim()) return
    setLoading(caseId)
    try {
      const res = await fetch(`/api/qa/cycle-cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'qa_retest', status, retestNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update test case')
      setRetestingId(null)
      setRetestNotes('')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update test case')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className={compact ? 'mb-2' : 'mb-3'}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Test cases</div>
        <div className="text-xs text-gray-500">
          {passed}/{cases.length} passed
          {failed > 0 && <span className="text-red-600 ml-1">· {failed} failed/blocked</span>}
        </div>
      </div>

      {allowDevFix && summary.failing > 0 && (
        <div className={`mb-3 p-2.5 rounded-lg text-xs ${
          summary.allFailuresFixed
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {summary.allFailuresFixed
            ? 'All failures marked as fixed — QA will re-test on this cycle.'
            : `${summary.unfixed} failed test case(s) need your fix. Mark each one fixed when done.`}
        </div>
      )}

      {allowQARetest && summary.awaitingQARetest > 0 && (
        <div className="mb-3 p-2.5 rounded-lg text-xs bg-teal-50 border border-teal-200 text-teal-800">
          {summary.awaitingQARetest} test case(s) ready for re-test on this cycle. Verify each fix below.
        </div>
      )}

      <div className="space-y-1.5">
        {cases.map(tc => {
          const cfg = TEST_CYCLE_CASE_STATUS_CONFIG[tc.status] ?? TEST_CYCLE_CASE_STATUS_CONFIG.pass
          const isFailing = tc.status === 'fail' || tc.status === 'blocked'
          const awaitingRetest = isFailing && !!tc.devFixedAt
          const canDevFix = allowDevFix && isFailing && !tc.devFixedAt
          const canQARetest = allowQARetest && awaitingRetest
          const isFixing = fixingId === tc.id
          const isRetesting = retestingId === tc.id

          return (
            <div
              key={tc.id}
              className={`rounded-lg px-2.5 py-2 text-xs ${
                isFailing && !tc.devFixedAt
                  ? 'bg-red-50'
                  : awaitingRetest
                  ? 'bg-amber-50'
                  : tc.status === 'pass'
                  ? 'bg-green-50/50'
                  : 'bg-gray-50'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className={`badge shrink-0 ${cfg.cls}`}>
                  {awaitingRetest ? 'Awaiting re-test' : cfg.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-800">{tc.title}</div>
                  {tc.notes && (
                    <p className="text-gray-500 mt-0.5 whitespace-pre-wrap">{tc.notes}</p>
                  )}
                  {tc.devFixedAt && tc.devFixNotes && (
                    <p className="text-green-700 mt-1 whitespace-pre-wrap">
                      ✓ Fixed by {tc.devFixedBy?.name ?? 'dev'} · {fmtDate(tc.devFixedAt)}: {tc.devFixNotes}
                    </p>
                  )}
                  {tc.qaRetestedAt && tc.qaRetestNotes && (
                    <p className={`mt-1 whitespace-pre-wrap ${
                      isFailing ? 'text-red-700' : 'text-teal-700'
                    }`}>
                      QA ({tc.qaRetestedBy?.name ?? 'QA'} · {fmtDate(tc.qaRetestedAt)}): {tc.qaRetestNotes}
                    </p>
                  )}
                </div>
              </div>

              {canDevFix && !isFixing && (
                <button
                  type="button"
                  className="btn-secondary text-xs mt-2 py-1 px-2"
                  onClick={() => {
                    setFixingId(tc.id)
                    setFixNotes('')
                  }}
                >
                  Mark as fixed
                </button>
              )}

              {isFixing && (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    className="input text-xs"
                    value={fixNotes}
                    onChange={e => setFixNotes(e.target.value)}
                    placeholder="What did you fix? (required)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs py-1 px-2"
                      disabled={loading === tc.id || !fixNotes.trim()}
                      onClick={() => submitFix(tc.id)}
                    >
                      {loading === tc.id ? 'Saving...' : 'Submit fix to QA'}
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

              {canQARetest && !isRetesting && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button
                    type="button"
                    className="btn-primary text-xs py-1 px-2 bg-green-700 hover:bg-green-800"
                    disabled={loading === tc.id}
                    onClick={() => submitRetest(tc.id, 'pass')}
                  >
                    {loading === tc.id ? 'Saving...' : '✓ Verify pass'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1 px-2 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setRetestingId(tc.id)
                      setRetestNotes('')
                    }}
                  >
                    Still failing
                  </button>
                </div>
              )}

              {isRetesting && (
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={2}
                    className="input text-xs border-red-200"
                    value={retestNotes}
                    onChange={e => setRetestNotes(e.target.value)}
                    placeholder="What is still broken? (required)"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn-primary text-xs py-1 px-2 bg-red-600 hover:bg-red-700"
                      disabled={loading === tc.id || !retestNotes.trim()}
                      onClick={() => submitRetest(tc.id, 'fail')}
                    >
                      {loading === tc.id ? 'Saving...' : 'Reopen for dev'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() => setRetestingId(null)}
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
