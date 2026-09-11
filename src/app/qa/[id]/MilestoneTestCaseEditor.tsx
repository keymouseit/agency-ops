'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import {
  TEST_CASE_STATUSES,
  TEST_CASE_STATUS_CONFIG,
  testCaseSummary,
} from '@/lib/milestone-qa'

type TestCase = {
  id: string
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
}: {
  milestoneId: string
  milestoneStatus: string
  testCases: TestCase[]
}) {
  const router = useRouter()
  const [testCases, setTestCases] = useState(initialCases)
  const [loading, setLoading] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const canEdit = ['testing', 'done'].includes(milestoneStatus)
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
    if (!confirm('Delete this test case?')) return
    setLoading(caseId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/test-cases/${caseId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete')
      setTestCases(prev => prev.filter(tc => tc.id !== caseId))
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

  if (milestoneStatus === 'ready_for_qa') {
    return (
      <div className="mt-3 pt-3 border-t border-blue-100">
        <button
          type="button"
          onClick={startTesting}
          disabled={loading === 'start'}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {loading === 'start' ? 'Starting…' : 'Start testing'}
        </button>
        <p className="text-xs text-gray-400 mt-2">Begin testing to add test cases and track progress for the developer.</p>
      </div>
    )
  }

  if (!['testing', 'done'].includes(milestoneStatus)) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
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

      <div className="space-y-2 mb-3">
        {testCases.map(tc => {
          const cfg = TEST_CASE_STATUS_CONFIG[tc.status] ?? TEST_CASE_STATUS_CONFIG.pending
          return (
            <div key={tc.id} className="rounded-lg border border-gray-100 bg-white p-2.5">
              <div className="flex items-start gap-2">
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
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{tc.title}</div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(tc)}
                          disabled={loading === tc.id}
                          aria-label="Edit test case"
                          title="Edit test case"
                          className="shrink-0 p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
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
                  <select
                    value={tc.status}
                    disabled={loading === tc.id}
                    onChange={e => updateCase(tc.id, { status: e.target.value })}
                    className={`text-xs rounded border px-1.5 py-1 ${cfg.cls}`}
                  >
                    {TEST_CASE_STATUSES.map(s => (
                      <option key={s} value={s}>{TEST_CASE_STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                )}
                {!canEdit && <span className={`badge text-xs ${cfg.cls}`}>{cfg.label}</span>}
              </div>
              {canEdit ? (
                <textarea
                  className="input text-xs mt-2 w-full"
                  rows={2}
                  placeholder="Notes (failure reason, steps, etc.)"
                  defaultValue={tc.notes ?? ''}
                  onBlur={e => {
                    const val = e.target.value.trim()
                    if (val !== (tc.notes ?? '')) updateCase(tc.id, { notes: val })
                  }}
                />
              ) : tc.notes ? (
                <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{tc.notes}</p>
              ) : null}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteCase(tc.id)}
                  disabled={loading === tc.id}
                  className="text-xs text-red-500 hover:text-red-700 mt-1"
                >
                  Delete
                </button>
              )}
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
