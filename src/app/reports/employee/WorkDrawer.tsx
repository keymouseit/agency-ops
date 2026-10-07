'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { formatIst, formatIstDate, istDateInputValue } from '@/lib/ist'
import LinkifiedText from '@/components/LinkifiedText'

export type WorkTask = {
  id: string
  title: string
  status: string
  hours: number
  dateKey: string
}

export type WorkMilestone = {
  id: string
  title: string
  status: string
  chip: 'approved' | 'needs_attention' | 'delayed' | 'upcoming'
  label: string
  daysLate: number | null
  dueDate: string | null
}

export type WorkProject = {
  projectId: string | null
  projectName: string
  hoursLogged: number
  hoursPlanned: number
  sharePct: number
  done: number
  partial: number
  planned: number
  moved: number
  tasks: WorkTask[]
  milestones: WorkMilestone[]
  missedDeadline: { dueDate: string; daysLate: number; detail: string } | null
  blockers: {
    id: string
    description: string
    category: string
    status: string
    raisedAt: string
  }[]
}

export type WorkDayMeta = {
  dateKey: string
  date: string
  leaveBadge: string | null
  isHoliday: boolean
  isFullDayLeave: boolean
  holidayName: string | null
  logged: number
}

export type WorkWeek = {
  startKey: string
  endKey: string
  label: string
  hoursLogged: number
  hoursExpected?: number
  planDays?: number
  workingDays?: number
  eodDays?: number
  eodEligible?: number
  tasksDone?: number
  tasksTotal?: number
  projects: WorkProject[]
  dayMeta: WorkDayMeta[]
}

/** Optional per-day plan/EOD from report hours.byDay — shown in By day headers. */
export type WorkDayHoursStatus = {
  dateKey: string
  hasPlan: boolean
  hasEod: boolean
  expected: number
  phase: string
}

export const PROJECT_BAR_COLORS = [
  '#2563eb',
  '#7c3aed',
  '#059669',
  '#d97706',
  '#e11d48',
  '#0891b2',
  '#4f46e5',
  '#ca8a04',
]

type MilestonePayload = {
  milestone: {
    id: string
    title: string
    status: string
    statusLabel: string
    statusCls: string
    dueDate: string | null
    completedAt: string | null
    daysLate: number | null
    project: { id: string; name: string }
  }
  linkNote: string
  days: {
    date: string
    dateKey: string
    hours: number
    tasks: { id: string; title: string; status: string; hours: number }[]
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

function milestoneChipCls(chip: string) {
  switch (chip) {
    case 'needs_attention':
      return 'bg-amber-50 text-amber-900 ring-amber-200'
    case 'delayed':
      return 'bg-red-50 text-red-800 ring-red-200'
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-200'
  }
}

function projectLabel(name: string) {
  return name === 'No project' ? 'No project' : name
}

function isNoProject(p: WorkProject) {
  return !p.projectId || p.projectName === 'No project'
}

function sortProjects(list: WorkProject[]) {
  return [...list].sort((a, b) => {
    const aNone = isNoProject(a)
    const bNone = isNoProject(b)
    if (aNone !== bNone) return aNone ? 1 : -1
    return b.hoursLogged - a.hoursLogged
  })
}

function eachDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = []
  let [y, m, d] = startKey.split('-').map(Number)
  const end = endKey
  while (true) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (key > end) break
    keys.push(key)
    const dt = new Date(Date.UTC(y, m - 1, d + 1))
    y = dt.getUTCFullYear()
    m = dt.getUTCMonth() + 1
    d = dt.getUTCDate()
  }
  return keys
}

function weekdayShort(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d, 6, 30)))
}

export default function WorkDrawer({
  open,
  onClose,
  memberId,
  from,
  to,
  week,
  initialProjectKey = null,
  initialFocusDateKey = null,
  dayHoursStatus = null,
}: {
  open: boolean
  onClose: () => void
  memberId: string
  from: string
  to: string
  week: WorkWeek | null
  /** When set, open in project-focused mode (tasks for that project only). */
  initialProjectKey?: string | null
  /** When set, scroll the By day list to this dateKey after open. */
  initialFocusDateKey?: string | null
  /** Optional plan/EOD status per day (from report hours.byDay). */
  dayHoursStatus?: WorkDayHoursStatus[] | null
}) {
  const scrollBodyRef = useRef<HTMLDivElement>(null)
  const [filterProjectKey, setFilterProjectKey] = useState<string | null>(null)
  /** True when opened from a project row — hides week chrome until "View whole week". */
  const [projectFocus, setProjectFocus] = useState(false)
  /** User expanded day-bar open back to full week inside the drawer. */
  const [dayFocusCleared, setDayFocusCleared] = useState(false)
  const [approvedOpen, setApprovedOpen] = useState(false)
  const [milestoneId, setMilestoneId] = useState<string | null>(null)
  const [msLoading, setMsLoading] = useState(false)
  const [msError, setMsError] = useState<string | null>(null)
  const [msData, setMsData] = useState<MilestonePayload | null>(null)

  useEffect(() => {
    if (!open) {
      setFilterProjectKey(null)
      setProjectFocus(false)
      setDayFocusCleared(false)
      setApprovedOpen(false)
      setMilestoneId(null)
      setMsData(null)
      setMsError(null)
      return
    }
    const key = initialProjectKey ?? null
    setFilterProjectKey(key)
    setProjectFocus(Boolean(key))
    setDayFocusCleared(false)
    setApprovedOpen(false)
    setMilestoneId(null)
    setMsData(null)
    setMsError(null)
  }, [open, week?.startKey, initialProjectKey, initialFocusDateKey])

  const loadMilestone = useCallback(async () => {
    if (!milestoneId || !open) return
    setMsLoading(true)
    setMsError(null)
    try {
      const qs = new URLSearchParams({ memberId, milestoneId, from, to })
      const res = await fetch(`/api/reports/employee/milestone-activity?${qs}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Failed (${res.status})`)
      }
      setMsData((await res.json()) as MilestonePayload)
    } catch (e) {
      setMsData(null)
      setMsError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setMsLoading(false)
    }
  }, [milestoneId, memberId, from, to, open])

  useEffect(() => {
    if (milestoneId) void loadMilestone()
  }, [milestoneId, loadMilestone])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (milestoneId) setMilestoneId(null)
        else onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, milestoneId])

  const projects = useMemo(
    () => (week ? sortProjects(week.projects.filter(p => p.hoursLogged > 0 || p.tasks.length > 0)) : []),
    [week],
  )

  const colorByKey = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p, i) => {
      map.set(p.projectId ?? '__none__', PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length])
    })
    return map
  }, [projects])

  const statusByKey = useMemo(() => {
    const m = new Map<string, WorkDayHoursStatus>()
    for (const d of dayHoursStatus ?? []) m.set(d.dateKey, d)
    return m
  }, [dayHoursStatus])

  /** Day-bar open: scope drawer to that single day (unless user clears or project-focused). */
  const dayFocusKey =
    !projectFocus && !dayFocusCleared && initialFocusDateKey ? initialFocusDateKey : null

  const attention = useMemo(() => {
    if (!week) return { delayed: [] as WorkMilestone[], needs: [] as WorkMilestone[], deadlines: [] as WorkProject[], blockers: [] as { project: WorkProject; b: WorkProject['blockers'][number] }[], approved: [] as WorkMilestone[] }
    const delayed: WorkMilestone[] = []
    const needs: WorkMilestone[] = []
    const approved: WorkMilestone[] = []
    const deadlines: WorkProject[] = []
    const blockers: { project: WorkProject; b: WorkProject['blockers'][number] }[] = []

    for (const p of week.projects) {
      const pKey = p.projectId ?? '__none__'
      if (projectFocus && filterProjectKey && filterProjectKey !== pKey) continue

      if (p.missedDeadline) {
        if (!dayFocusKey) {
          deadlines.push(p)
        } else {
          const dueKey = p.missedDeadline.dueDate
            ? istDateInputValue(p.missedDeadline.dueDate)
            : null
          if (dueKey === dayFocusKey) deadlines.push(p)
        }
      }
      for (const m of p.milestones) {
        if (dayFocusKey) {
          const dueKey = m.dueDate ? istDateInputValue(m.dueDate) : null
          if (dueKey !== dayFocusKey) continue
        }
        if (m.chip === 'delayed') delayed.push(m)
        else if (m.chip === 'needs_attention') needs.push(m)
        else if (m.chip === 'approved') approved.push(m)
      }
      for (const b of p.blockers) {
        if (dayFocusKey) {
          const raisedKey = istDateInputValue(b.raisedAt)
          if (raisedKey !== dayFocusKey) continue
        }
        blockers.push({ project: p, b })
      }
    }
    return { delayed, needs, deadlines, blockers, approved }
  }, [week, projectFocus, filterProjectKey, dayFocusKey])

  const byDay = useMemo(() => {
    if (!week) return []
    // Clamp to the report date range (from/to), then Mon–Fri always; Sat/Sun only with tasks
    let keys = eachDateKeys(week.startKey, week.endKey).filter(
      k => (!from || k >= from) && (!to || k <= to),
    )
    const spanDays = keys.length
    // Day-bar path: only the clicked day
    if (dayFocusKey) keys = keys.filter(k => k === dayFocusKey)
    const metaByKey = new Map(week.dayMeta.map(d => [d.dateKey, d]))

    return keys
      .map(dateKey => {
        const dayWd = weekdayShort(dateKey)
        const isWeekend = dayWd === 'Sat' || dayWd === 'Sun'
        const meta = metaByKey.get(dateKey)
        const leave = Boolean(meta?.isHoliday || meta?.isFullDayLeave)
        const leaveLabel =
          meta?.leaveBadge ||
          (meta?.isHoliday
            ? meta.holidayName
              ? `Holiday · ${meta.holidayName}`
              : 'Holiday'
            : meta?.isFullDayLeave
              ? 'Full day leave'
              : null)

        const projectBuckets: {
          project: WorkProject
          color: string
          hours: number
          tasks: WorkTask[]
        }[] = []

        let dayHours = 0
        for (const p of week.projects) {
          const pKey = p.projectId ?? '__none__'
          if (filterProjectKey && filterProjectKey !== pKey) continue
          const tasks = p.tasks.filter(t => t.dateKey === dateKey)
          if (tasks.length === 0) continue
          const hours = Math.round(tasks.reduce((s, t) => s + t.hours, 0) * 10) / 10
          dayHours += hours
          projectBuckets.push({
            project: p,
            color: colorByKey.get(pKey) ?? '#94a3b8',
            hours,
            tasks,
          })
        }
        projectBuckets.sort((a, b) => b.hours - a.hours)

        const dateIso = meta?.date ?? `${dateKey}T00:00:00.000Z`
        return {
          dateKey,
          dateIso,
          wd: dayWd,
          isWeekend,
          leave,
          leaveLabel,
          dayHours: Math.round(dayHours * 10) / 10,
          projectBuckets,
        }
      })
      .filter(d => {
        // Day-focus: always show the clicked day (even empty / weekend)
        if (dayFocusKey) return true
        if (d.projectBuckets.length > 0) return true
        // Weekends with no work stay hidden
        if (d.isWeekend) return false
        // Multi-week / period span: skip empty weekdays (only show leave/holiday stubs)
        if (spanDays > 7) return Boolean(d.leave)
        // Single week: Mon–Fri always show (empty / leave / holiday)
        return true
      })
  }, [week, filterProjectKey, colorByKey, from, to, dayFocusKey])

  if (!open || !week) return null

  const isPeriodSpan = eachDateKeys(week.startKey, week.endKey).length > 7

  const showMilestone = Boolean(milestoneId)
  const focusedProject =
    projectFocus && filterProjectKey
      ? week.projects.find(p => (p.projectId ?? '__none__') === filterProjectKey) ?? null
      : null
  const focusedColor =
    filterProjectKey && colorByKey.get(filterProjectKey)
      ? colorByKey.get(filterProjectKey)!
      : PROJECT_BAR_COLORS[0]

  const counts = week.projects.reduce(
    (a, p) => ({
      done: a.done + p.done,
      partial: a.partial + p.partial,
      moved: a.moved + p.moved,
      planned: a.planned + p.planned,
    }),
    { done: 0, partial: 0, moved: 0, planned: 0 },
  )

  const hasAttention =
    attention.delayed.length > 0 ||
    attention.needs.length > 0 ||
    attention.deadlines.length > 0 ||
    attention.blockers.length > 0

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={dayFocusKey ? "Day details" : "Week details"}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <aside className="absolute inset-y-0 right-0 w-full sm:w-[520px] max-w-full bg-white shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            {showMilestone ? (
              <button
                type="button"
                onClick={() => setMilestoneId(null)}
                className="text-[11px] font-semibold text-blue-600 hover:underline mb-1"
              >
                ← Back
              </button>
            ) : null}
            {showMilestone && msData ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 truncate">
                  {msData.milestone.project.name}
                </p>
                <h2 className="text-base font-bold text-gray-900 leading-snug whitespace-normal break-words [overflow-wrap:anywhere]">
                  {msData.milestone.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${msData.milestone.statusCls}`}>
                    {msData.milestone.statusLabel}
                  </span>
                  {msData.milestone.dueDate && (
                    <span className="text-[11px] text-gray-500">
                      Due {formatIstDate(msData.milestone.dueDate)}
                      {msData.milestone.daysLate != null && msData.milestone.daysLate > 0
                        ? ` · ${msData.milestone.daysLate}d late`
                        : ''}
                    </span>
                  )}
                </div>
              </>
            ) : projectFocus && focusedProject ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {isPeriodSpan ? 'Project this period' : 'Project this week'}
                </p>
                <div className="flex items-center gap-2 min-w-0 mt-0.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: focusedColor }}
                  />
                  <h2 className="text-lg font-bold text-gray-900 leading-snug truncate">
                    {projectLabel(focusedProject.projectName)}
                  </h2>
                </div>
                <p className="text-sm text-gray-600 mt-1 tabular-nums min-w-0 whitespace-normal break-words">
                  {week.label}
                  <span className="text-gray-300 mx-1">·</span>
                  <span className="font-semibold text-gray-900">
                    {Number(focusedProject.hoursLogged.toFixed(1))}h
                  </span>
                  <span className="text-gray-300 mx-1">·</span>
                  {focusedProject.tasks.length} task
                  {focusedProject.tasks.length === 1 ? '' : 's'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setProjectFocus(false)
                    setFilterProjectKey(null)
                  }}
                  className="mt-2 text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  {isPeriodSpan ? 'View whole period →' : 'View whole week →'}
                </button>
              </>
            ) : dayFocusKey ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Day details</p>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">
                  {byDay[0]
                    ? formatIst(byDay[0].dateIso, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                    : dayFocusKey}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5 tabular-nums">
                  <span className="font-semibold text-gray-900">
                    {byDay[0] ? byDay[0].dayHours : 0}h
                  </span>
                  <span className="text-gray-300 mx-1">·</span>
                  {week.label}
                </p>
                {(() => {
                  const hd = statusByKey.get(dayFocusKey)
                  if (!hd) return null
                  return (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hd.hasPlan ? 'bg-emerald-50 text-emerald-800' : hd.expected > 0 ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        {hd.hasPlan ? 'Plan' : hd.expected > 0 ? 'No plan' : 'Plan —'}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded ${
                          hd.hasEod
                            ? 'bg-emerald-50 text-emerald-800'
                            : hd.hasPlan && hd.phase === 'past'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-50 text-slate-600'
                        }`}
                      >
                        {hd.hasEod
                          ? 'EOD'
                          : hd.hasPlan && hd.phase === 'past'
                            ? 'No EOD'
                            : 'EOD —'}
                      </span>
                    </div>
                  )
                })()}
                <button
                  type="button"
                  onClick={() => setDayFocusCleared(true)}
                  className="mt-2 text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  View whole week →
                </button>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {isPeriodSpan ? 'Period details' : 'Week details'}
                </p>
                <h2 className="text-lg font-bold text-gray-900 leading-snug">{week.label}</h2>
                <p className="text-sm text-gray-600 mt-0.5 tabular-nums">
                  <span className="font-semibold text-gray-900">{Number(week.hoursLogged.toFixed(1))}h</span>
                  {week.hoursExpected != null ? (
                    <span className="text-gray-400"> of {Number(week.hoursExpected.toFixed(1))}h</span>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800">{counts.done} done</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">{counts.partial} partial</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-700">{counts.moved} moved</span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">{counts.planned} planned</span>
                  {week.planDays != null && week.workingDays != null && (
                    <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-800">
                      Plans {week.planDays}/{week.workingDays}
                    </span>
                  )}
                  {week.eodDays != null && week.eodEligible != null && week.eodEligible > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800">
                      EOD {week.eodDays}/{week.eodEligible}
                    </span>
                  )}
                </div>
              </>
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

        <div
          ref={scrollBodyRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-5 min-w-0"
        >
          {showMilestone ? (
            <>
              {msLoading && (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-lg bg-gray-100 h-16" />
                  ))}
                </div>
              )}
              {!msLoading && msError && (
                <div className="rounded-lg bg-red-50 text-red-800 text-sm px-3 py-3">{msError}</div>
              )}
              {!msLoading && msData && (
                <>
                  <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2 leading-snug">
                    {msData.linkNote}
                  </p>
                  {msData.days.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">No tasks in the milestone window.</p>
                  ) : (
                    <div className="space-y-3">
                      {msData.days.map(day => (
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
                                <span className="flex-1 min-w-0">
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
                </>
              )}
            </>
          ) : (
            <>
              {!projectFocus && !dayFocusKey && (
              <section>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                    Projects this week
                  </h3>
                  {filterProjectKey && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                      onClick={() => setFilterProjectKey(null)}
                    >
                      All projects
                    </button>
                  )}
                </div>
                {projects.length === 0 ? (
                  <p className="text-xs text-gray-400">No project work this week.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {projects.map(p => {
                      const key = p.projectId ?? '__none__'
                      const color = colorByKey.get(key) ?? '#94a3b8'
                      const active = filterProjectKey === key
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => setFilterProjectKey(active ? null : key)}
                            className={`w-full grid items-center gap-x-2 px-2 h-9 rounded-md text-left min-w-0 ${
                              active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                            }`}
                            style={{ gridTemplateColumns: '10px minmax(0,1fr) 44px 36px 100px 56px' }}
                          >
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {projectLabel(p.projectName)}
                            </span>
                            <span className="text-xs font-semibold tabular-nums text-right text-gray-800">
                              {Number(p.hoursLogged.toFixed(1))}h
                            </span>
                            <span className="text-[11px] tabular-nums text-right text-gray-400">{p.sharePct}%</span>
                            <span className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${Math.min(100, p.sharePct)}%`, background: color }}
                              />
                            </span>
                            <span className="text-[11px] text-gray-500 tabular-nums whitespace-nowrap">
                              {p.tasks.length} task{p.tasks.length === 1 ? '' : 's'}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              )}

              {/* By day — main */}
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {dayFocusKey ? 'Tasks this day' : 'By day'}
                  {!projectFocus && filterProjectKey ? (
                    <span className="normal-case font-semibold text-blue-700 ml-1">
                      · filtered
                    </span>
                  ) : null}
                </h3>
                {byDay.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    {projectFocus
                      ? 'No tasks for this project this week.'
                      : dayFocusKey
                        ? 'No work logged this day.'
                        : 'No work logged this week.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {byDay.map(day => {
                      const dateLabel = formatIst(day.dateIso, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })
                      // Empty day (no tasks for filter/project): compact muted card
                      const hd = statusByKey.get(day.dateKey)
                      const planEod = hd ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-semibold shrink-0">
                          <span
                            className={
                              hd.hasPlan
                                ? 'text-emerald-700'
                                : hd.expected > 0
                                  ? 'text-amber-700'
                                  : 'text-gray-400'
                            }
                          >
                            {hd.hasPlan ? 'Plan' : hd.expected > 0 ? 'No plan' : '—'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span
                            className={
                              hd.hasEod
                                ? 'text-emerald-700'
                                : hd.hasPlan && hd.phase === 'past'
                                  ? 'text-amber-700'
                                  : 'text-gray-400'
                            }
                          >
                            {hd.hasEod
                              ? 'EOD'
                              : hd.hasPlan && hd.phase === 'past'
                                ? 'No EOD'
                                : 'EOD —'}
                          </span>
                        </span>
                      ) : null
                      const focused = 'ring-1 ring-gray-100'
                      if (day.projectBuckets.length === 0) {
                        return (
                          <div
                            key={day.dateKey}
                            data-day-key={day.dateKey}
                            className={`rounded-lg overflow-hidden min-w-0 bg-slate-50/60 ${focused}`}
                          >
                            <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                              <span className="text-xs font-semibold text-gray-500 tabular-nums">
                                {dateLabel} · 0h
                              </span>
                              {day.leaveLabel ? (
                                <span className="text-[10px] font-semibold text-violet-700 truncate">
                                  {day.leaveLabel}
                                </span>
                              ) : (
                                planEod
                              )}
                            </div>
                            {!day.leaveLabel && (
                              <p className="px-3 pb-2 text-[11px] text-gray-400">
                                {projectFocus
                                  ? 'No work on this project'
                                  : filterProjectKey
                                    ? 'No work on this project'
                                    : 'No work logged'}
                              </p>
                            )}
                          </div>
                        )
                      }
                      return (
                        <div
                          key={day.dateKey}
                          data-day-key={day.dateKey}
                          className={`rounded-lg overflow-hidden min-w-0 ${focused}`}
                        >
                          <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-50">
                            <span className="text-xs font-semibold text-gray-800">
                              {dateLabel} · {day.dayHours}h
                            </span>
                            {day.leaveLabel ? (
                              <span className="text-[10px] font-semibold text-violet-700 truncate">
                                {day.leaveLabel}
                              </span>
                            ) : (
                              planEod
                            )}
                          </div>
                          <div className="divide-y divide-gray-50">
                            {day.projectBuckets.map(({ project, color, tasks }) => (
                              <div key={project.projectId ?? project.projectName} className="px-3 py-2 min-w-0">
                                {!projectFocus && (
                                  <div className="flex items-center gap-1.5 mb-1 min-w-0">
                                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                                    {project.projectId ? (
                                      <Link
                                        href={`/projects/${project.projectId}`}
                                        className="text-[11px] font-semibold text-gray-600 hover:text-blue-600 truncate"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        {projectLabel(project.projectName)}
                                      </Link>
                                    ) : (
                                      <span className="text-[11px] font-semibold text-gray-500 truncate">
                                        {projectLabel(project.projectName)}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <ul className="space-y-1">
                                  {tasks.map(t => (
                                    <li key={t.id} className="flex items-start gap-2 text-sm min-w-0">
                                      <span className="shrink-0 mt-0.5">{statusBadge(t.status)}</span>
                                      <span className="flex-1 min-w-0">
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
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Needs attention */}
              {hasAttention && (
                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                    Needs attention
                  </h3>
                  <ul className="space-y-1">
                    {attention.deadlines.map(p => (
                      <li
                        key={`dl-${p.projectId}`}
                        className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-md bg-red-50/80 text-red-900 min-w-0"
                      >
                        <span className="font-bold shrink-0">Deadline missed</span>
                        {!projectFocus && (
                          <span className="truncate font-medium">{projectLabel(p.projectName)}</span>
                        )}
                        <span className="text-red-700/80 shrink-0 ml-auto">
                          {p.missedDeadline?.daysLate != null ? `${p.missedDeadline.daysLate}d late` : ''}
                        </span>
                      </li>
                    ))}
                    {attention.delayed.map(m => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setMilestoneId(m.id)}
                          className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ring-1 text-left min-w-0 ${milestoneChipCls('delayed')}`}
                        >
                          <span className="font-bold shrink-0">Delayed</span>
                          <span className="truncate font-medium flex-1">{m.title}</span>
                          {m.daysLate != null && (
                            <span className="shrink-0 opacity-80">{m.daysLate}d late</span>
                          )}
                        </button>
                      </li>
                    ))}
                    {attention.needs.map(m => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setMilestoneId(m.id)}
                          className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md ring-1 text-left min-w-0 ${milestoneChipCls('needs_attention')}`}
                        >
                          <span className="font-bold shrink-0">Needs attention</span>
                          <span className="truncate font-medium flex-1">{m.title}</span>
                          {m.dueDate && (
                            <span className="shrink-0 opacity-80">Due {formatIstDate(m.dueDate)}</span>
                          )}
                        </button>
                      </li>
                    ))}
                    {attention.blockers.map(({ project, b }) => (
                      <li
                        key={b.id}
                        className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-md bg-amber-50 text-amber-900 min-w-0"
                      >
                        {statusBadge(b.status)}
                        <span className="flex-1 min-w-0">
                          {!projectFocus && (
                            <span className="font-semibold">{projectLabel(project.projectName)} · </span>
                          )}
                          <LinkifiedText text={b.description} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Approved collapsed */}
              {attention.approved.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setApprovedOpen(o => !o)}
                    className="text-[11px] text-emerald-700/90 hover:text-emerald-900 font-medium"
                  >
                    ✓ {attention.approved.length} milestone
                    {attention.approved.length === 1 ? '' : 's'} approved
                    {projectFocus ? ' for this project' : dayFocusKey ? ' this day' : ' this week'}
                    <span className="text-emerald-600/70 ml-1">{approvedOpen ? '▴' : '▾'}</span>
                  </button>
                  {approvedOpen && (
                    <ul className="mt-1 space-y-0.5 pl-2">
                      {attention.approved.map(m => (
                        <li key={m.id} className="text-[11px] text-gray-500 truncate">
                          {m.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}
