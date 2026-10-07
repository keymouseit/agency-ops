'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatIst, formatIstDate } from '@/lib/ist'
import LinkifiedText from '@/components/LinkifiedText'

type DrawerPayload = {
  milestone: {
    id: string
    title: string
    status: string
    statusLabel: string
    statusCls: string
    dueDate: string | null
    completedAt: string | null
    qaStartedAt: string | null
    daysLate: number | null
    notes: string | null
    project: { id: string; name: string }
  }
  linkMode: 'project_window'
  linkNote: string
  window: {
    start: string | null
    end: string | null
    prevMilestoneTitle: string | null
    allTime: boolean
  }
  days: {
    date: string
    dateKey: string
    hours: number
    tasks: {
      id: string
      title: string
      status: string
      hours: number
    }[]
  }[]
  qa: {
    testCases: {
      id: string
      title: string
      status: string
      testedAt: string | null
      notes: string | null
      testedBy: { id: string; name: string } | null
    }[]
    bugs: {
      id: string
      title: string
      status: string
      severity: string
      createdAt: string
      resolvedAt: string | null
      reportedBy: { id: string; name: string }
    }[]
    testCycles: {
      id: string
      cycleType: string
      result: string
      startedAt: string
      completedAt: string | null
      summary: string | null
      conductedBy: { id: string; name: string }
    }[]
  }
  blockers: {
    id: string
    description: string
    status: string
    category: string
    raisedAt: string
    resolvedAt: string | null
  }[]
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    done: 'bg-emerald-50 text-emerald-800',
    partial: 'bg-amber-50 text-amber-800',
    blocked: 'bg-red-50 text-red-800',
    moved: 'bg-sky-50 text-sky-800',
    skipped: 'bg-gray-100 text-gray-600',
    planned: 'bg-blue-50 text-blue-800',
    open: 'bg-red-50 text-red-800',
    in_progress: 'bg-amber-50 text-amber-800',
    pass: 'bg-emerald-50 text-emerald-800',
    fail: 'bg-red-50 text-red-800',
    pending: 'bg-gray-100 text-gray-600',
  }
  return (
    <span
      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${
        map[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function MilestoneActivityDrawer({
  open,
  onClose,
  memberId,
  milestoneId,
  from,
  to,
}: {
  open: boolean
  onClose: () => void
  memberId: string
  milestoneId: string | null
  from: string
  to: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DrawerPayload | null>(null)
  const [allTime, setAllTime] = useState(false)

  const load = useCallback(async () => {
    if (!milestoneId || !open) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        memberId,
        milestoneId,
        from,
        to,
        ...(allTime ? { allTime: '1' } : {}),
      })
      const res = await fetch(`/api/reports/employee/milestone-activity?${qs}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed (${res.status})`)
      }
      const json = (await res.json()) as DrawerPayload
      setData(json)
    } catch (e) {
      setData(null)
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [milestoneId, memberId, from, to, allTime, open])

  useEffect(() => {
    if (!open) {
      setData(null)
      setError(null)
      setAllTime(false)
      return
    }
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Milestone activity">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 w-full sm:w-[420px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">
              {data?.milestone.project.name ?? 'Milestone'}
            </p>
            <h2 className="text-base font-bold text-gray-900 leading-snug whitespace-normal break-words [overflow-wrap:anywhere]">
              {data?.milestone.title ?? (loading ? 'Loading…' : 'Milestone')}
            </h2>
            {data && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${data.milestone.statusCls}`}>
                  {data.milestone.statusLabel}
                </span>
                {data.milestone.dueDate && (
                  <span className="text-[11px] text-gray-500">
                    Due {formatIstDate(data.milestone.dueDate)}
                    {data.milestone.daysLate != null && data.milestone.daysLate > 0
                      ? ` · ${data.milestone.daysLate}d late`
                      : ''}
                  </span>
                )}
                {data.milestone.completedAt && (
                  <span className="text-[11px] text-emerald-700">
                    Approved {formatIstDate(data.milestone.completedAt)}
                  </span>
                )}
                {data.milestone.qaStartedAt && !data.milestone.completedAt && (
                  <span className="text-[11px] text-blue-700">
                    QA since {formatIstDate(data.milestone.qaStartedAt)}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close drawer"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allTime}
              onChange={e => setAllTime(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show all time
          </label>
          {data?.window.start && data.window.end && (
            <span className="text-[10px] text-gray-400 truncate">
              {formatIst(data.window.start, { day: 'numeric', month: 'short' })} –{' '}
              {formatIst(data.window.end, { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-4 min-w-0">
          {loading && (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-lg bg-gray-100 h-16" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-lg bg-red-50 text-red-800 text-sm px-3 py-3">{error}</div>
          )}

          {!loading && data && (
            <>
              <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2 leading-snug">
                {data.linkNote}
              </p>

              {data.days.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-8">
                  No tasks logged on this project in the milestone window.
                </div>
              ) : (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Work by day
                  </h3>
                  {data.days.map(day => (
                    <div key={day.dateKey} className="rounded-lg ring-1 ring-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50">
                        <span className="text-xs font-semibold text-gray-800">
                          {formatIst(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs tabular-nums font-bold text-gray-700">{day.hours}h</span>
                      </div>
                      <ul className="divide-y divide-gray-50">
                        {day.tasks.map(t => (
                          <li key={t.id} className="px-3 py-1.5 flex items-start gap-2 text-sm min-w-0">
                            <span className="shrink-0 mt-0.5">{statusBadge(t.status)}</span>
                            <span className="flex-1 min-w-0 text-gray-700">
                              <LinkifiedText text={t.title} />
                            </span>
                            <span className="text-[11px] tabular-nums text-gray-500 shrink-0">
                              {t.hours > 0 ? `${t.hours}h` : '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {(data.qa.testCases.length > 0 ||
                data.qa.bugs.length > 0 ||
                data.qa.testCycles.length > 0) && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    QA & approvals
                  </h3>
                  {data.qa.testCases.length > 0 && (
                    <div className="rounded-lg ring-1 ring-gray-100 p-2.5 space-y-1.5">
                      <p className="text-[11px] font-semibold text-gray-600">Test cases</p>
                      {data.qa.testCases.map(t => (
                        <div key={t.id} className="flex items-start gap-2 text-xs min-w-0">
                          <span className="shrink-0">{statusBadge(t.status)}</span>
                          <span className="min-w-0 flex-1 text-gray-700">
                            <LinkifiedText text={t.title} />
                          </span>
                          {t.testedAt && (
                            <span className="text-gray-400 shrink-0">{formatIstDate(t.testedAt)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {data.qa.bugs.length > 0 && (
                    <div className="rounded-lg ring-1 ring-gray-100 p-2.5 space-y-1.5">
                      <p className="text-[11px] font-semibold text-gray-600">Bugs</p>
                      {data.qa.bugs.map(b => (
                        <div key={b.id} className="flex items-start gap-2 text-xs min-w-0">
                          <span className="shrink-0">{statusBadge(b.status)}</span>
                          <span className="min-w-0 flex-1 text-gray-700">
                            <LinkifiedText text={b.title} />
                          </span>
                          <span className="text-gray-400 capitalize shrink-0">{b.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {data.qa.testCycles.map(c => (
                    <div key={c.id} className="rounded-lg ring-1 ring-gray-100 p-2.5 text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        {statusBadge(c.result)}
                        <span className="font-semibold text-gray-800 capitalize">
                          {c.cycleType.replace(/_/g, ' ')} cycle
                        </span>
                        <span className="text-gray-400 ml-auto">{formatIstDate(c.startedAt)}</span>
                      </div>
                      {c.summary && (
                      <p className="text-gray-600 mt-1 min-w-0">
                        <LinkifiedText text={c.summary} />
                      </p>
                    )}
                      <p className="text-gray-400 mt-0.5">by {c.conductedBy.name}</p>
                    </div>
                  ))}
                </div>
              )}

              {data.blockers.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Blockers
                  </h3>
                  {data.blockers.map(b => (
                    <div key={b.id} className="rounded-lg ring-1 ring-gray-100 p-2.5 text-xs">
                      <div className="flex items-center gap-2 mb-0.5">
                        {statusBadge(b.status)}
                        <span className="text-gray-400">{formatIstDate(b.raisedAt)}</span>
                      </div>
                      <p className="text-gray-800 min-w-0"><LinkifiedText text={b.description} /></p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
