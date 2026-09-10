'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import { fmtDate } from '@/lib/utils'
import MilestoneTestProgress from '@/components/MilestoneTestProgress'
import MilestoneBugFixActions from '@/components/MilestoneBugFixActions'
import {
  MILESTONE_STATUS_CONFIG,
  calculateMilestoneProgress,
  openBugCount,
  SerializedBug,
} from '@/lib/milestone-qa'

type TestCase = {
  id: string
  title: string
  status: string
  notes: string | null
  testedAt: string | null
  testedBy: { name: string } | null
}

export type TimelineMilestone = {
  id: string
  title: string
  dueDate: Date | string | null
  status: string
  completedAt: Date | string | null
  notes?: string | null
  createdById?: string | null
  qaStartedAt?: string | null
  testCases?: TestCase[]
  bugs?: SerializedBug[]
}

function toDateInputValue(value: Date | string | null | undefined) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function MilestoneTimeline({
  milestones,
  showActions = true,
  currentUserId,
  userRole,
}: {
  milestones: TimelineMilestone[]
  showActions?: boolean
  currentUserId?: string
  userRole?: string
}) {
  const router = useRouter()
  const [items, setItems] = useState(milestones)
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<TimelineMilestone | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const localOverrides = useRef<Record<string, { status: string; at: number }>>({})

  useEffect(() => {
    setItems(
      milestones.map(m => {
        const override = localOverrides.current[m.id]
        if (override) {
          if (override.status === m.status) {
            delete localOverrides.current[m.id]
            return m
          }
          if (Date.now() - override.at < 8000) {
            return {
              ...m,
              status: override.status,
              completedAt: override.status === 'done' ? m.completedAt ?? new Date().toISOString() : null,
              qaStartedAt:
                override.status === 'pending' || override.status === 'in_progress'
                  ? null
                  : m.qaStartedAt,
            }
          }
          delete localOverrides.current[m.id]
        }
        return m
      })
    )
  }, [milestones])

  function canManageContent(m: TimelineMilestone) {
    if (m.status !== 'pending') return false
    if (!currentUserId) return false
    if (m.createdById && m.createdById === currentUserId) return true
    if (userRole === 'Founder' && !m.createdById) return true
    return false
  }

  function openEdit(m: TimelineMilestone) {
    setEditing(m)
    setEditTitle(m.title)
    setEditDueDate(toDateInputValue(m.dueDate))
    setEditNotes(m.notes ?? '')
    setEditError('')
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/projects/milestones/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          dueDate: editDueDate || null,
          notes: editNotes,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update milestone')
      setItems(curr =>
        curr.map(m =>
          m.id === editing.id
            ? {
                ...m,
                title: data.title ?? editTitle,
                dueDate: data.dueDate ?? (editDueDate || null),
                notes: data.notes ?? (editNotes.trim() || null),
              }
            : m
        )
      )
      setEditing(null)
      softRefresh(router)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update milestone')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteMilestone(m: TimelineMilestone) {
    if (!confirm(`Delete milestone "${m.title}"? This cannot be undone.`)) return
    setLoading(m.id)
    const previous = items
    setItems(curr => curr.filter(item => item.id !== m.id))
    try {
      const res = await fetch(`/api/projects/milestones/${m.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to delete milestone')
      softRefresh(router)
    } catch (err) {
      setItems(previous)
      alert(err instanceof Error ? err.message : 'Failed to delete milestone')
    } finally {
      setLoading(null)
    }
  }

  async function updateMilestoneStatus(milestoneId: string, newStatus: string) {
    setLoading(milestoneId)
    localOverrides.current[milestoneId] = { status: newStatus, at: Date.now() }
    setItems(curr =>
      curr.map(m =>
        m.id === milestoneId
          ? {
              ...m,
              status: newStatus,
              completedAt: newStatus === 'done' ? new Date().toISOString() : null,
              qaStartedAt:
                newStatus === 'pending' || newStatus === 'in_progress' ? null : m.qaStartedAt,
            }
          : m
      )
    )
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to update milestone')
      if (data?.status) {
        localOverrides.current[milestoneId] = { status: data.status, at: Date.now() }
        setItems(curr =>
          curr.map(m =>
            m.id === milestoneId
              ? {
                  ...m,
                  status: data.status,
                  completedAt: data.completedAt ?? null,
                  qaStartedAt: data.qaStartedAt ?? null,
                }
              : m
          )
        )
      }
      softRefresh(router)
    } catch (err) {
      delete localOverrides.current[milestoneId]
      setItems(milestones)
      alert(err instanceof Error ? err.message : 'Failed to update milestone')
    } finally {
      setLoading(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-gray-700">No milestones yet</p>
        <p className="text-sm text-gray-400 mt-1">Add milestones to track delivery progress.</p>
      </div>
    )
  }

  const doneCount = items.filter(m => m.status === 'done').length
  const progressPct = calculateMilestoneProgress(items)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Milestone timeline</h2>
        <span className="text-sm text-gray-500">
          {progressPct}% · {doneCount}/{items.length} approved
        </span>
      </div>

      <ol className="relative">
        {items.map((m, index) => {
          const pill = MILESTONE_STATUS_CONFIG[m.status] ?? MILESTONE_STATUS_CONFIG.pending
          const isDone = m.status === 'done'
          const isActive = m.status === 'in_progress' || m.status === 'ready_for_qa' || m.status === 'testing'
          const isCurrent =
            !isDone &&
            items.findIndex(item => item.status !== 'done') === index
          const isOverdue =
            !!m.dueDate && new Date(m.dueDate) < new Date() && m.status !== 'done'
          const testCases = m.testCases ?? []
          const bugs = m.bugs ?? []
          const canExpand = ['ready_for_qa', 'testing', 'done'].includes(m.status)
          const isExpanded = expanded === m.id
          const openBugs = openBugCount(bugs)
          const isLast = index === items.length - 1
          const canManage = canManageContent(m)

          return (
            <li key={m.id} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <span
                  className="absolute left-[15px] top-8 bottom-0 w-px bg-gray-200"
                  aria-hidden
                />
              )}

              <div className="relative z-10 shrink-0">
                {isDone ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                      isActive || isCurrent
                        ? 'border-green-700 bg-white text-green-800'
                        : 'border-gray-300 bg-white text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <button
                  type="button"
                  className={`text-left w-full ${canExpand ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={canExpand ? () => setExpanded(isExpanded ? null : m.id) : undefined}
                  disabled={!canExpand}
                >
                  <div
                    className={`text-base font-semibold ${
                      isDone ? 'text-gray-500' : 'text-gray-900'
                    }`}
                  >
                    {m.title}
                  </div>
                  {m.notes ? (
                    <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">{m.notes}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.cls}`}>
                      {pill.label}
                    </span>
                    {openBugs > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        {openBugs} open bug{openBugs === 1 ? '' : 's'}
                      </span>
                    )}
                    {isOverdue && (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.75}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {m.dueDate ? (
                      <span>Due {fmtDate(m.dueDate)}</span>
                    ) : (
                      <span>No due date</span>
                    )}
                    {m.completedAt && (
                      <span className="text-green-700">· Completed {fmtDate(m.completedAt)}</span>
                    )}
                  </div>
                </button>

                {showActions && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {loading === m.id ? (
                      <span className="text-xs text-gray-400">Updating…</span>
                    ) : (
                      <>
                        {m.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => updateMilestoneStatus(m.id, 'in_progress')}
                            className="inline-flex items-center rounded-full bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800"
                          >
                            Start milestone
                          </button>
                        )}
                        {m.status === 'in_progress' && (
                          <>
                            <button
                              type="button"
                              onClick={() => updateMilestoneStatus(m.id, 'ready_for_qa')}
                              className="inline-flex items-center rounded-full bg-green-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-800"
                            >
                              Send to QA
                            </button>
                            <button
                              type="button"
                              onClick={() => updateMilestoneStatus(m.id, 'pending')}
                              className="inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Pause
                            </button>
                          </>
                        )}
                        {m.status === 'ready_for_qa' && (
                          <button
                            type="button"
                            onClick={() => updateMilestoneStatus(m.id, 'in_progress')}
                            className="inline-flex items-center rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Move back to in progress
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(m)}
                              className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMilestone(m)}
                              className="inline-flex items-center rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                    <MilestoneTestProgress
                      milestoneTitle={m.title}
                      milestoneStatus={m.status}
                      qaStartedAt={m.qaStartedAt}
                      testCases={testCases}
                      bugs={bugs}
                    />
                    <MilestoneBugFixActions milestoneId={m.id} bugs={bugs} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Edit milestone</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={saveEdit} className="p-5 space-y-3">
              {editError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  {editError}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Title *</label>
                  <input
                    required
                    className="input"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">Due date</label>
                  <input
                    type="date"
                    className="input"
                    value={editDueDate}
                    onChange={e => setEditDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="label">Details</label>
                <textarea
                  rows={4}
                  className="input"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  placeholder="Describe the scope of this milestone…"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editSaving} className="btn-primary">
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
