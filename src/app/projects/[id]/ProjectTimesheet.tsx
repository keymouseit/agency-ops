'use client'

import { useMemo, useState } from 'react'
import { fmtDate } from '@/lib/utils'
import { MILESTONE_STATUS_CONFIG } from '@/lib/milestone-qa'
import {
  type TimesheetEntry,
  type TimesheetMilestone,
  buildTimesheetSummary,
  entryLoggedHours,
  groupEntriesByWeek,
} from '@/lib/project-timesheet'

type ViewId = 'overview' | 'diary'

const TASK_STATUS_CLS: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-600',
  done: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
  moved: 'bg-blue-100 text-blue-800',
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

function formatHours(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'green' | 'amber' | 'red'
}) {
  const tones = {
    neutral: 'text-gray-900',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-600',
  }
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </div>
  )
}

export default function ProjectTimesheet({
  projectName,
  estimatedHours,
  contractValue,
  currency,
  showValue,
  startDate,
  estimatedEnd,
  entries,
  milestones,
}: {
  projectName: string
  estimatedHours: number | null
  contractValue: number | null
  currency: string
  showValue: boolean
  startDate: string | null
  estimatedEnd: string | null
  entries: TimesheetEntry[]
  milestones: TimesheetMilestone[]
}) {
  const [view, setView] = useState<ViewId>('overview')
  const [memberFilter, setMemberFilter] = useState<string>('all')
  // undefined = default to newest week; null = all collapsed; string = that week open
  const [openWeek, setOpenWeek] = useState<string | null | undefined>(undefined)
  const [openDay, setOpenDay] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (memberFilter === 'all') return entries
    return entries.filter(e => e.memberId === memberFilter)
  }, [entries, memberFilter])

  const summary = useMemo(
    () => buildTimesheetSummary(filtered, { estimatedHours, milestones }),
    [filtered, estimatedHours, milestones],
  )

  const weeks = useMemo(() => groupEntriesByWeek(filtered), [filtered])
  const maxWeekHours = Math.max(1, ...summary.weekBars.map(w => w.hours))

  const memberOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of entries) map.set(e.memberId, e.memberName)
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const resolvedOpenWeek = openWeek === undefined ? (weeks[0]?.weekStart ?? null) : openWeek

  function toggleWeek(weekStart: string) {
    setOpenDay(null)
    setOpenWeek(prev => {
      const current = prev === undefined ? weeks[0]?.weekStart ?? null : prev
      return current === weekStart ? null : weekStart
    })
  }

  function toggleDay(date: string) {
    setOpenDay(prev => (prev === date ? null : date))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Timesheet</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Hours, team activity, and work diary for {projectName} — like a contract overview and detail view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {memberOptions.length > 1 && (
            <select
              className="input text-sm py-1.5 w-auto min-w-[9rem]"
              value={memberFilter}
              onChange={e => {
                setMemberFilter(e.target.value)
                setOpenWeek(undefined)
                setOpenDay(null)
              }}
              aria-label="Filter by team member"
            >
              <option value="all">All team</option>
              {memberOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5">
            {([
              { id: 'overview' as const, label: 'Overview' },
              { id: 'diary' as const, label: 'Work diary' },
            ]).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === tab.id
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Hours logged"
              value={`${formatHours(summary.totalHours)}h`}
              hint={
                summary.plannedOnlyHours > 0
                  ? `${formatHours(summary.loggedHours)}h confirmed · ${formatHours(summary.plannedOnlyHours)}h planned`
                  : `${summary.entryCount} entries`
              }
            />
            <StatCard
              label="This week"
              value={`${formatHours(summary.hoursThisWeek)}h`}
              hint={`Last week ${formatHours(summary.hoursLastWeek)}h`}
            />
            <StatCard
              label="Vs estimate"
              value={summary.burnPct != null ? `${summary.burnPct}%` : '—'}
              tone={
                summary.burnPct == null
                  ? 'neutral'
                  : summary.burnPct > 120
                    ? 'red'
                    : summary.burnPct > 100
                      ? 'amber'
                      : 'green'
              }
              hint={
                estimatedHours != null
                  ? `${formatHours(estimatedHours)}h estimated${
                      summary.remaining != null
                        ? ` · ${summary.remaining >= 0 ? `${formatHours(summary.remaining)}h left` : `${formatHours(Math.abs(summary.remaining))}h over`}`
                        : ''
                    }`
                  : 'No estimate set'
              }
            />
            <StatCard
              label="Milestones"
              value={
                summary.milestonesTotal > 0
                  ? `${summary.milestonesDone}/${summary.milestonesTotal}`
                  : '—'
              }
              hint={summary.milestonesTotal > 0 ? 'QA approved' : 'No milestones yet'}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Weekly hours</h3>
                <span className="text-xs text-gray-400">Last 8 weeks</span>
              </div>
              {summary.weekBars.every(w => w.hours === 0) ? (
                <p className="text-sm text-gray-400 py-8 text-center">No hours logged yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2 sm:gap-2.5">
                    {summary.weekBars.map(bar => (
                      <div
                        key={`v-${bar.weekStart}`}
                        className="flex-1 text-center text-[10px] tabular-nums text-gray-600 h-4 leading-4"
                      >
                        {bar.hours > 0 ? formatHours(bar.hours) : ''}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 sm:gap-2.5 h-36">
                    {summary.weekBars.map(bar => {
                      const pct = bar.hours > 0
                        ? Math.max(4, Math.round((bar.hours / maxWeekHours) * 100))
                        : 0
                      return (
                        <div
                          key={bar.weekStart}
                          className="relative flex-1 min-w-0 h-full rounded-t bg-gray-100 overflow-hidden"
                          title={`${bar.label}: ${formatHours(bar.hours)}h`}
                        >
                          <div
                            className="absolute bottom-0 left-0 right-0 rounded-t bg-emerald-600/85"
                            style={{ height: `${pct}%` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 sm:gap-2.5">
                    {summary.weekBars.map(bar => (
                      <div
                        key={`l-${bar.weekStart}`}
                        className="flex-1 text-center text-[10px] text-gray-400 truncate leading-tight"
                      >
                        {bar.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Contract snapshot</h3>
              <p className="text-xs text-gray-500 mb-4">Project window and commercial context</p>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Period</dt>
                  <dd className="text-gray-900 text-right">
                    {startDate ? fmtDate(startDate) : '—'}
                    {' → '}
                    {estimatedEnd ? fmtDate(estimatedEnd) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Estimated hours</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">
                    {estimatedHours != null ? `${formatHours(estimatedHours)}h` : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Hours burned</dt>
                  <dd className="font-medium text-gray-900 tabular-nums">{formatHours(summary.totalHours)}h</dd>
                </div>
                {showValue && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-gray-500">Contract value</dt>
                    <dd className="font-medium text-gray-900 tabular-nums">
                      {contractValue != null
                        ? `${currency} ${contractValue.toLocaleString()}`
                        : '—'}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Blocked tasks</dt>
                  <dd className={`font-medium tabular-nums ${summary.blockedCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {summary.blockedCount}
                  </dd>
                </div>
              </dl>
            </section>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Hours by person</h3>
              {summary.members.length === 0 ? (
                <p className="text-sm text-gray-400">No team hours yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.members.map(m => {
                    const pct = summary.totalHours > 0 ? Math.round((m.hours / summary.totalHours) * 100) : 0
                    return (
                      <li key={m.memberId}>
                        <div className="flex items-center justify-between gap-2 text-sm mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                              {initials(m.memberName) || '?'}
                            </span>
                            <span className="truncate font-medium text-gray-800">{m.memberName}</span>
                          </div>
                          <span className="tabular-nums text-gray-700 shrink-0">
                            {formatHours(m.hours)}h
                            <span className="text-gray-400 text-xs ml-1">({pct}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Milestones</h3>
              {milestones.length === 0 ? (
                <p className="text-sm text-gray-400">No milestones on this project.</p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {milestones.map((m, i) => {
                    const cfg = MILESTONE_STATUS_CONFIG[m.status] ?? MILESTONE_STATUS_CONFIG.pending
                    return (
                      <li key={m.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            <span className="text-gray-400 font-normal mr-1">{i + 1}.</span>
                            {m.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {m.dueDate ? `Due ${fmtDate(m.dueDate)}` : 'No due date'}
                            {m.completedAt ? ` · Done ${fmtDate(m.completedAt)}` : ''}
                          </div>
                        </div>
                        <span className={`badge text-xs shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          {summary.taskTypes.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">By work type</h3>
              <div className="flex flex-wrap gap-2">
                {summary.taskTypes.map(t => (
                  <span
                    key={t.type}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700"
                  >
                    <span className="capitalize font-medium">{t.type.replace(/_/g, ' ')}</span>
                    <span className="tabular-nums text-gray-500">{formatHours(t.hours)}h</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {weeks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center">
              <p className="text-sm font-medium text-gray-700">No work diary entries</p>
              <p className="mt-1 text-sm text-gray-400">
                Morning plan tasks linked to this project will appear here by week and day.
              </p>
            </div>
          ) : (
            weeks.map(week => {
              const entryCount = week.days.reduce((n, d) => n + d.entries.length, 0)
              const isWeekOpen = resolvedOpenWeek === week.weekStart
              const weekPanelId = `timesheet-week-${week.weekStart}`

              return (
                <section
                  key={week.weekStart}
                  className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleWeek(week.weekStart)}
                    aria-expanded={isWeekOpen}
                    aria-controls={weekPanelId}
                    className="flex w-full items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/80 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${isWeekOpen ? 'rotate-90' : ''}`}
                        aria-hidden
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900">
                          Week of {fmtDate(week.weekStart)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
                          {' · '}
                          {week.days.length} {week.days.length === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 shrink-0">
                      {formatHours(week.hours)}h
                    </span>
                  </button>

                  {isWeekOpen && (
                    <div id={weekPanelId} className="divide-y divide-gray-100">
                      {week.days.map(day => {
                        const isDayOpen = openDay === day.date
                        const dayPanelId = `timesheet-day-${day.date}`
                        return (
                          <div key={day.date}>
                            <button
                              type="button"
                              onClick={() => toggleDay(day.date)}
                              aria-expanded={isDayOpen}
                              aria-controls={dayPanelId}
                              className="flex w-full items-center justify-between gap-2 px-4 sm:px-5 py-3 text-left hover:bg-gray-50/70 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`shrink-0 text-gray-400 transition-transform ${isDayOpen ? 'rotate-90' : ''}`}
                                  aria-hidden
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </span>
                                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  {fmtDate(day.date)}
                                </h4>
                                <span className="text-[11px] text-gray-400">
                                  {day.entries.length} {day.entries.length === 1 ? 'entry' : 'entries'}
                                </span>
                              </div>
                              <span className="text-xs font-semibold tabular-nums text-gray-700">
                                {formatHours(day.hours)}h
                              </span>
                            </button>

                            {isDayOpen && (
                              <ul id={dayPanelId} className="space-y-2 px-4 sm:px-5 pb-3">
                                {day.entries.map(entry => {
                                  const hours = entryLoggedHours(entry)
                                  const statusCls = TASK_STATUS_CLS[entry.status] ?? TASK_STATUS_CLS.planned
                                  return (
                                    <li
                                      key={entry.id}
                                      className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5"
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
                                          title={entry.memberName}
                                        >
                                          {initials(entry.memberName) || '?'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span className="text-xs font-semibold text-gray-700">{entry.memberName}</span>
                                            <span className={`badge text-[10px] ${statusCls}`}>
                                              {entry.status}
                                            </span>
                                            <span className="badge text-[10px] bg-white text-gray-600 border border-gray-200 capitalize">
                                              {entry.taskType.replace(/_/g, ' ')}
                                            </span>
                                            <span className="ml-auto text-xs font-semibold tabular-nums text-emerald-800">
                                              {hours > 0 ? `${formatHours(hours)}h` : '—'}
                                              {entry.actualHours == null && entry.estimatedHours != null && (
                                                <span className="font-normal text-amber-700"> planned</span>
                                              )}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                                            {entry.title}
                                          </p>
                                          {entry.eodNotes && (
                                            <p className="mt-1.5 text-xs text-gray-500 whitespace-pre-wrap">
                                              {entry.eodNotes}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
