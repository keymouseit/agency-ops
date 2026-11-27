'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import {
  SerializedBug,
  TEST_CASE_STATUSES,
  TEST_CASE_STATUS_CONFIG,
  testCaseSummary,
} from '@/lib/milestone-qa'
import MilestoneBugEditor from './MilestoneBugEditor'

type TestCase = {
  id: string
  caseNumber?: number
  displayId?: string | null
  title: string
  status: string
  notes: string | null
  testedAt: string | null
  testedBy: { name: string } | null
}

export default function MilestoneTestCaseEditor({
  milestoneId,
  milestoneStatus,
  testCases: initialCases,
  bugs: initialBugs = [],
}: {
  milestoneId: string
  milestoneStatus: string
  testCases: TestCase[]
  bugs?: SerializedBug[]
}) {
  const router = useRouter()
  const [testCases, setTestCases] = useState(initialCases)
  const [bugs, setBugs] = useState(initialBugs)
  const [loading, setLoading] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const canEdit = ['testing', 'done', 'in_progress'].includes(milestoneStatus)
  const showStartTesting = milestoneStatus === 'ready_for_qa'
  const canView =
    canEdit ||
    showStartTesting ||
    (milestoneStatus === 'ready_for_qa' && testCases.length > 0)
  const summary = testCaseSummary(testCases)

  function startEdit(tc: TestCase) {
    setEditingId(tc.id)
    setEditTitle(tc.title)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
  }

  async function saveTitle(caseId: string) {
    const trimmed = editTitle.trim()
    if (!trimmed) return
    const current = testCases.find(tc => tc.id === caseId)
    if (current && trimmed === current.title) {
      cancelEdit()
      return
    }
    const ok = await updateCase(caseId, { title: trimmed })
    if (ok) cancelEdit()
  }

  async function startTesting() {
    setLoading('start')
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/test-cases`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_testing' }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to start testing')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start testing')
    } finally {
      setLoading(null)
    }
  }

  async function addTestCase(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add test case')
      setTestCases(prev => [...prev, data])
      setNewTitle('')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add test case')
    } finally {
      setAdding(false)
    }
  }

  async function updateCase(caseId: string, updates: { status?: string; notes?: string; title?: string }) {
    setLoading(caseId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/test-cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setTestCases(prev => prev.map(tc => (tc.id === caseId ? data : tc)))
      router.refresh()
      return true
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update')
      return false
    } finally {
      setLoading(null)
    }
  }

  async function deleteCase(caseId: string) {
    if (!confirm('Delete this test case and its linked bugs?')) return
    setLoading(caseId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/test-cases/${caseId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      setTestCases(prev => prev.filter(tc => tc.id !== caseId))
      setBugs(prev => prev.filter(b => b.testCaseId !== caseId))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLoading(null)
    }
  }

  if (milestoneStatus === 'pending') {
    return <p className="text-xs text-gray-400 mt-2">Waiting for developer to send to QA.</p>
  }

  if (!canView && !showStartTesting) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {showStartTesting && (
        <div className="mb-3">
          <button
            type="button"
            onClick={startTesting}
            disabled={loading === 'start'}
            className="btn-primary text-xs py-1.5 px-3"
          >
            {loading === 'start' ? 'Starting…' : 'Start testing'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            {testCases.length > 0
              ? 'Existing test cases are listed below. Start testing to edit statuses and add more.'
              : 'Begin testing to add test cases and track progress for the developer.'}
          </p>
        </div>
      )}

      {testCases.length > 0 && (
        <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
          <span>
            {summary.completed}/{summary.total} completed
            {summary.failed > 0 && <span className="text-red-600 ml-1">· {summary.failed} failed</span>}
            {summary.blocked > 0 && <span className="text-orange-600 ml-1">· {summary.blocked} blocked</span>}
          </span>
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${summary.failed > 0 ? 'bg-red-400' : summary.blocked > 0 ? 'bg-amber-400' : 'bg-green-500'}`}
              style={{ width: `${summary.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-3 mb-3">
        {testCases.map(tc => {
          const cfg = TEST_CASE_STATUS_CONFIG[tc.status] ?? TEST_CASE_STATUS_CONFIG.pending
          const caseBugs = bugs.filter(b => b.testCaseId === tc.id)
          return (
            <div
              key={tc.id}
              className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm ring-1 ring-black/[0.02]"
            >
              <div className="flex items-start gap-2">
                {canEdit && editingId !== tc.id && (
                  <button
                    type="button"
                    onClick={() => deleteCase(tc.id)}
                    disabled={loading === tc.id}
                    aria-label="Delete test case"
                    title="Delete test case"
                    className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  {editingId === tc.id ? (
                    <form
                      className="flex items-center gap-1.5"
                      onSubmit={e => {
                        e.preventDefault()
                        void saveTitle(tc.id)
                      }}
                    >
                      <input
                        className="input text-sm flex-1 min-w-0"
                        value={editTitle}
                        autoFocus
                        disabled={loading === tc.id}
                        onChange={e => setEditTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                      <button
                        type="submit"
                        disabled={loading === tc.id || !editTitle.trim()}
                        className="btn-primary text-xs py-1 px-2 shrink-0"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={loading === tc.id}
                        className="btn-secondary text-xs py-1 px-2 shrink-0"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      {tc.displayId && (
                        <span className="font-mono text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-md shrink-0">
                          {tc.displayId}
                        </span>
                      )}
                      <div className="text-sm font-semibold text-gray-900 truncate">{tc.title}</div>
                      {tc.status === 'fail' && (
                        <span className="badge text-xs bg-red-100 text-red-800 shrink-0">Failed</span>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(tc)}
                          disabled={loading === tc.id}
                          aria-label="Edit test case"
                          title="Edit test case"
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                  {tc.testedAt && tc.testedBy && editingId !== tc.id && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {tc.testedBy.name} · {fmtDate(tc.testedAt)}
                    </div>
                  )}
                </div>
                {canEdit && editingId !== tc.id && (
                  loading === tc.id ? (
                    <div
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 px-1.5 py-1"
                      role="status"
                      aria-live="polite"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin"
                        aria-hidden="true"
                      />
                      Saving…
                    </div>
                  ) : (
                    <select
                      value={tc.status}
                      onChange={e => updateCase(tc.id, { status: e.target.value })}
                      className="text-xs rounded-md border border-gray-200 bg-white text-gray-800 px-2 py-1.5 shadow-sm"
                    >
                      {TEST_CASE_STATUSES.map(s => (
                        <option key={s} value={s}>{TEST_CASE_STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                  )
                )}
                {!canEdit && <span className={`badge text-xs ${cfg.cls}`}>{cfg.label}</span>}
              </div>
              {canEdit ? (
                <textarea
                  className="input text-sm mt-2.5 w-full !min-h-0 h-16 resize-y"
                  rows={2}
                  placeholder="Notes (failure reason, steps, etc.)"
                  defaultValue={tc.notes ?? ''}
                  onBlur={e => {
                    const val = e.target.value.trim()
                    if (val !== (tc.notes ?? '')) updateCase(tc.id, { notes: val })
                  }}
                />
              ) : tc.notes ? (
                <p className="text-xs text-gray-500 mt-1.5 whitespace-pre-wrap">{tc.notes}</p>
              ) : null}

              <MilestoneBugEditor
                key={`${tc.id}-${caseBugs.map(b => b.id).join(',')}`}
                milestoneId={milestoneId}
                testCaseId={tc.id}
                testCaseDisplayId={tc.displayId}
                milestoneStatus={milestoneStatus}
                bugs={caseBugs}
              />
            </div>
          )
        })}
      </div>

      {canEdit && (
        <form onSubmit={addTestCase} className="flex gap-2">
          <input
            className="input text-sm flex-1"
            placeholder="Add test case (e.g. Login with valid credentials)"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
          />
          <button type="submit" disabled={adding || !newTitle.trim()} className="btn-secondary text-xs shrink-0">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
    </div>
  )
}
