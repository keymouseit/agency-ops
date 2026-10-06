'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { differenceInDays, startOfDay } from 'date-fns'
import {
  fmtDate,
  isMomActionClosed,
  MOM_ACTION_STATUS_COLORS,
  momActionStatusLabel,
} from '@/lib/utils'

type ActionItem = {
  id: string
  title: string
  dueDate: string
  status: string
  blockedReason: string | null
  owner: { id: string; name: string; role?: string }
}

const UPDATE_HINT = 'Only owner or Founder/Manager can update'
const REOPEN_HINT =
  'After Submit Only Founder/Manager can change status after Completed / Not completed / Skipped'
const SECTION_HINT =
  'Actions start Open. Mark In progress when you start. After In progress, pick Yes / No / Skipped — No saves as Not completed. Yes = Completed; Skipped needs a reason. After Completed / Not completed / Skipped, only Founder/Manager can change status.'

function SavingSpinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin ${className}`}
      aria-hidden="true"
    />
  )
}

export default function MomActionList({
  momId,
  actions,
  currentMemberId,
  canManageAll,
}: {
  momId: string
  actions: ActionItem[]
  currentMemberId?: string | null
  canManageAll?: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState(actions)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busyStatus, setBusyStatus] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [skipReasonFor, setSkipReasonFor] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState('')

  async function setStatus(actionId: string, status: string, blockedReason?: string) {
    setBusyId(actionId)
    setBusyStatus(status)
    setError('')
    try {
      const res = await fetch(`/api/mom/${momId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, actionStatus: status, blockedReason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not update action.')
        return
      }
      const updated = await res.json()
      // Persist immediately in local state (status + reason), then refresh server tree.
      setRows(prev =>
        prev.map(a =>
          a.id === actionId
            ? {
                ...a,
                ...updated,
                status: updated.status ?? status,
                blockedReason:
                  updated.blockedReason !== undefined
                    ? updated.blockedReason
                    : status === 'Skipped'
                      ? (blockedReason ?? null)
                      : null,
                dueDate: updated.dueDate ?? a.dueDate,
                owner: updated.owner ?? a.owner,
              }
            : a
        )
      )
      setSkipReasonFor(null)
      setSkipReason('')
      router.refresh()
    } catch {
      setError('Could not update action.')
    } finally {
      setBusyId(null)
      setBusyStatus(null)
    }
  }

  const today = startOfDay(new Date())
  const anyBusy = busyId !== null
  const total = rows.length
  const done = rows.filter(a => a.status === 'Done').length
  const allDone = total > 0 && done === total

  const header = (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Action items</h2>
          {total > 0 && (
            <span
              className={`badge border tabular-nums text-xs font-semibold ${
                allDone
                  ? 'bg-green-50 text-green-800 border-green-200'
                  : 'bg-gray-100 text-gray-700 border-gray-200'
              }`}
              title={`${done} of ${total} completed`}
              aria-label={`${done} of ${total} action items completed`}
            >
              {done}/{total}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{SECTION_HINT}</p>
      </div>
    </div>
  )

  if (!rows.length) {
    return (
      <div>
        {header}
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-6 text-sm text-gray-500 text-center space-y-3">
          <p>No structured action items on this meeting.</p>
          <Link
            href={`/mom/${momId}/edit`}
            className="inline-flex items-center px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            + Add action
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      {header}
      <div className="space-y-3">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700">
          {error}
        </div>
      )}
      {rows.map(action => {
        const due = startOfDay(new Date(action.dueDate))
        const days = differenceInDays(due, today)
        const overdue = !isMomActionClosed(action.status) && days < 0
        const isOwner = !!currentMemberId && action.owner.id === currentMemberId
        const isDone = action.status === 'Done'
        const isNotCompleted = action.status === 'NotCompleted'
        const isSkipped = action.status === 'Skipped'
        const isBlocked = action.status === 'Blocked'
        const isOpen = action.status === 'Open'
        // Completed / Not completed / Skipped are final for the owner.
        const isFinal = isDone || isNotCompleted || isSkipped
        // Owner can move freely until a final outcome; then only Founder/Manager.
        const canChangeStatus = !!(canManageAll || (isOwner && !isFinal))
        const lockedHint = isFinal && !canManageAll ? REOPEN_HINT : UPDATE_HINT
        const rowBusy = busyId === action.id
        const showSkipInput = skipReasonFor === action.id && canChangeStatus

        // Completion choices after Open (InProgress / Blocked / Done / NotCompleted / Skipped).
        // Badge is primary signal; keep Yes/No/Skipped checked state visible when final.
        const showCompletionChoices = !isOpen
        // InProgress/Blocked: none selected. Done→Yes, NotCompleted→No, Skipped→Skipped.
        const choice: 'yes' | 'no' | 'skipped' | null =
          showSkipInput || isSkipped
            ? 'skipped'
            : isDone
              ? 'yes'
              : isNotCompleted
                ? 'no'
                : null

        // When already final: keep that box looking selected for leads; lock all for owner.
        const canSelectYes = !anyBusy && (isDone ? !!canManageAll : canChangeStatus)
        const canSelectNo = !anyBusy && (isNotCompleted ? !!canManageAll : canChangeStatus)
        const canSelectSkipped = !anyBusy && (isSkipped ? !!canManageAll : canChangeStatus)
        const canMarkInProgress = !anyBusy && canChangeStatus && (isOpen || isBlocked)
        const canReopen = !anyBusy && !!canManageAll && isFinal

        const groupId = `action-complete-${action.id}`

        return (
          <div
            key={action.id}
            className={`rounded-xl border p-4 ${overdue ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{action.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span>Owner: {action.owner.name}</span>
                  <span>·</span>
                  <span>Due {fmtDate(new Date(action.dueDate))}</span>
                  {overdue && (
                    <span className="badge border bg-red-50 text-red-700 border-red-200">
                      {Math.abs(days)}d overdue
                    </span>
                  )}
                  {!overdue && days === 0 && !isMomActionClosed(action.status) && (
                    <span className="badge border bg-amber-50 text-amber-800 border-amber-200">Due today</span>
                  )}
                  <span className={`badge border ${MOM_ACTION_STATUS_COLORS[action.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                    {momActionStatusLabel(action.status)}
                  </span>
                </div>
                {isBlocked && action.blockedReason && (
                  <p className="mt-2 text-xs text-red-700">Blocked: {action.blockedReason}</p>
                )}
                {isSkipped && action.blockedReason && !showSkipInput && (
                  <p className="mt-2 text-xs text-slate-600">Skipped: {action.blockedReason}</p>
                )}
                {!canChangeStatus && (
                  <p className="mt-2 text-[11px] text-gray-400">{lockedHint}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5 shrink-0 sm:items-end">
                {/* Open: only Mark in progress — no Yes/No/Skipped yet */}
                {isOpen && (
                  <button
                    type="button"
                    disabled={!canMarkInProgress}
                    title={!canMarkInProgress ? lockedHint : 'Mark this action as in progress'}
                    aria-busy={rowBusy && busyStatus === 'InProgress' ? true : undefined}
                    onClick={() => {
                      if (!canMarkInProgress) return
                      void setStatus(action.id, 'InProgress')
                    }}
                    className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {rowBusy && busyStatus === 'InProgress' ? (
                      <>
                        <SavingSpinner />
                        Saving…
                      </>
                    ) : (
                      'Mark in progress'
                    )}
                  </button>
                )}

                {/* InProgress / Blocked / Done / Skipped: completion question (checkbox look, single-select) */}
                {showCompletionChoices && (
                  <>
                    <div className="text-xs font-semibold text-gray-800" id={`${groupId}-label`}>
                      Have you completed this?
                    </div>
                    <div
                      className="flex flex-wrap gap-x-4 gap-y-2"
                      role="group"
                      aria-labelledby={`${groupId}-label`}
                    >
                      {/* Yes → Done */}
                      <label
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          !canSelectYes ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        } ${choice === 'yes' ? 'text-green-800' : 'text-gray-700'}`}
                        title={!canSelectYes ? lockedHint : undefined}
                      >
                        {rowBusy && busyStatus === 'Done' ? (
                          <SavingSpinner />
                        ) : (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                            checked={choice === 'yes'}
                            disabled={!canSelectYes}
                            aria-checked={choice === 'yes'}
                            onChange={e => {
                              if (!canSelectYes) return
                              // Mutual exclusivity: only apply when checking; ignore uncheck
                              if (!e.target.checked) return
                              if (isDone) return
                              setSkipReasonFor(null)
                              setSkipReason('')
                              void setStatus(action.id, 'Done')
                            }}
                          />
                        )}
                        Yes
                      </label>

                      {/* No → NotCompleted (final for owner; distinct from Open) */}
                      <label
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          !canSelectNo ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        } ${choice === 'no' ? 'text-orange-800' : 'text-gray-700'}`}
                        title={!canSelectNo ? lockedHint : 'Mark as Not completed'}
                      >
                        {rowBusy && busyStatus === 'NotCompleted' ? (
                          <SavingSpinner />
                        ) : (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            checked={choice === 'no'}
                            disabled={!canSelectNo}
                            aria-checked={choice === 'no'}
                            onChange={e => {
                              if (!canSelectNo) return
                              if (!e.target.checked) return
                              if (isNotCompleted) return
                              setSkipReasonFor(null)
                              setSkipReason('')
                              void setStatus(action.id, 'NotCompleted')
                            }}
                          />
                        )}
                        No
                      </label>

                      {/* Skipped → reason required */}
                      <label
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                          !canSelectSkipped ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                        } ${choice === 'skipped' ? 'text-slate-700' : 'text-gray-700'}`}
                        title={!canSelectSkipped ? lockedHint : undefined}
                      >
                        {rowBusy && busyStatus === 'Skipped' ? (
                          <SavingSpinner />
                        ) : (
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-slate-600 focus:ring-slate-500"
                            checked={choice === 'skipped'}
                            disabled={!canSelectSkipped}
                            aria-checked={choice === 'skipped'}
                            onChange={e => {
                              if (!canSelectSkipped) return
                              if (!e.target.checked) return
                              if (isSkipped && !showSkipInput) return
                              if (showSkipInput) return
                              setSkipReasonFor(action.id)
                              setSkipReason(isSkipped ? (action.blockedReason ?? '') : '')
                            }}
                          />
                        )}
                        Skipped
                      </label>
                    </div>

                    {/* Blocked: optional path back into flow */}
                    {isBlocked && (
                      <button
                        type="button"
                        disabled={!canMarkInProgress}
                        title={!canMarkInProgress ? lockedHint : 'Mark this action as in progress'}
                        aria-busy={rowBusy && busyStatus === 'InProgress' ? true : undefined}
                        onClick={() => {
                          if (!canMarkInProgress) return
                          setSkipReasonFor(null)
                          setSkipReason('')
                          void setStatus(action.id, 'InProgress')
                        }}
                        className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {rowBusy && busyStatus === 'InProgress' ? (
                          <>
                            <SavingSpinner />
                            Saving…
                          </>
                        ) : (
                          'Mark in progress'
                        )}
                      </button>
                    )}

                    {/* Founder/Manager: reopen final outcomes back to Open */}
                    {canReopen && (
                      <button
                        type="button"
                        disabled={!canReopen}
                        title="Reopen this action to Open"
                        aria-busy={rowBusy && busyStatus === 'Open' ? true : undefined}
                        onClick={() => {
                          if (!canReopen) return
                          setSkipReasonFor(null)
                          setSkipReason('')
                          void setStatus(action.id, 'Open')
                        }}
                        className="btn-secondary text-xs inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {rowBusy && busyStatus === 'Open' ? (
                          <>
                            <SavingSpinner />
                            Saving…
                          </>
                        ) : (
                          'Reopen'
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {showSkipInput && (
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  className="input flex-1"
                  value={skipReason}
                  onChange={e => setSkipReason(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && skipReason.trim() && !anyBusy) {
                      e.preventDefault()
                      void setStatus(action.id, 'Skipped', skipReason.trim())
                    }
                  }}
                  placeholder="Why skipped?"
                  disabled={rowBusy}
                  autoFocus
                  required
                  aria-label="Skipped reason"
                />
                <button
                  type="button"
                  disabled={!skipReason.trim() || anyBusy}
                  aria-busy={rowBusy && busyStatus === 'Skipped' ? true : undefined}
                  onClick={() => void setStatus(action.id, 'Skipped', skipReason.trim())}
                  className="btn-primary text-xs inline-flex items-center justify-center gap-1.5"
                >
                  {rowBusy && busyStatus === 'Skipped' ? (
                    <>
                      <SavingSpinner className="border-white/40 border-t-white" />
                      Saving…
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
                <button
                  type="button"
                  disabled={rowBusy}
                  onClick={() => {
                    if (rowBusy) return
                    setSkipReasonFor(null)
                    setSkipReason('')
                  }}
                  className="btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
