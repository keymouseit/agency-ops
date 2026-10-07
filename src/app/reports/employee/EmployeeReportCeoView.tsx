'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts'
import type { EmployeeReport } from '@/lib/employee-report'
import { istDateInputValue } from '@/lib/ist'
import {
  CEO,
  scoreColors,
  hoursColors,
  trendFromWeekScores,
  worstProjectTag,
  type TrendKind,
} from './ceo-report-helpers'
import { groupWeeksByMonth, WEEK_MONTH_GROUP_THRESHOLD } from './week-group-utils'
import WeekInlinePanel from './WeekInlinePanel'

type Employee = { id: string; name: string; email: string; role: string }
type RangeMode = 'week' | 'month' | 'this_month' | 'custom'

type WeekRow = NonNullable<EmployeeReport['weekByWeek']>['rows'][number]

function hrs(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Math.round(n * 10) / 10
  return Number.isInteger(v) ? `${v}h` : `${v}h`
}

function fmtDate(iso: string, withYear = false) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  })
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Monday (IST) of the week containing dateKey. */
function mondayKeyOf(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d, 6, 30)))
  const offset = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[wd] ?? 0
  return addDaysToDateKey(dateKey, -offset)
}

/** Friday (IST) of the Mon–Fri work week for this row. */
function weekFridayKey(r: { startKey: string }): string {
  return addDaysToDateKey(mondayKeyOf(r.startKey), 4)
}

function ScoreRingBig({ score }: { score: number }) {
  const { fg, bg } = scoreColors(score)
  const r = 36
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="relative h-[96px] w-[96px] shrink-0">
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke={bg} strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={fg}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-gray-900 leading-none">{score}</span>
        <span className="text-[10px] font-semibold text-gray-400">/100</span>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  pct,
  tone,
}: {
  label: string
  value: string
  sub: string
  pct: number | null
  tone: 'green' | 'amber' | 'red' | 'neutral'
}) {
  const colors =
    tone === 'green'
      ? hoursColors(100)
      : tone === 'amber'
        ? hoursColors(85)
        : tone === 'red'
          ? hoursColors(50)
          : { fg: '#64748b', bg: '#f1f5f9' }
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      {pct != null && (
        <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: colors.fg }}
          />
        </div>
      )}
    </div>
  )
}

/** Half-vs-half avg score bars — same split as trendFromWeekScores. */
function TrendHalfBars({
  firstAvg,
  secondAvg,
  accent,
}: {
  firstAvg: number
  secondAvg: number
  accent: string
}) {
  const max = Math.max(100, firstAvg, secondAvg, 1)
  const h = 44
  const barW = 28
  const gap = 18
  const baseY = 40
  const leftX = 8
  const rightX = leftX + barW + gap
  const firstH = Math.max(2, (firstAvg / max) * h)
  const secondH = Math.max(2, (secondAvg / max) * h)
  return (
    <svg
      width={leftX + barW + gap + barW + 8}
      height={58}
      viewBox={`0 0 ${leftX + barW + gap + barW + 8} 58`}
      className="shrink-0"
      aria-hidden
    >
      {/* Early weeks — muted */}
      <rect
        x={leftX}
        y={baseY - firstH}
        width={barW}
        height={firstH}
        rx={4}
        fill="#cbd5e1"
      />
      <text
        x={leftX + barW / 2}
        y={baseY - firstH - 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill="#64748b"
      >
        {Math.round(firstAvg)}
      </text>
      <text
        x={leftX + barW / 2}
        y={52}
        textAnchor="middle"
        fontSize={7}
        fontWeight={600}
        fill="#94a3b8"
      >
        Early
      </text>
      {/* Later weeks — accent */}
      <rect
        x={rightX}
        y={baseY - secondH}
        width={barW}
        height={secondH}
        rx={4}
        fill={accent}
      />
      <text
        x={rightX + barW / 2}
        y={baseY - secondH - 4}
        textAnchor="middle"
        fontSize={9}
        fontWeight={700}
        fill={accent}
      >
        {Math.round(secondAvg)}
      </text>
      <text
        x={rightX + barW / 2}
        y={52}
        textAnchor="middle"
        fontSize={7}
        fontWeight={600}
        fill="#94a3b8"
      >
        Later
      </text>
    </svg>
  )
}

function TrendKpiCard({
  kind,
  label,
  delta,
  scores,
  weekCount,
}: {
  kind: TrendKind
  label: string
  delta: number
  scores: number[]
  weekCount: number
}) {
  const tone =
    kind === 'up'
      ? { fg: CEO.green, bg: CEO.greenBg, arrow: '↑', verb: 'rose' }
      : kind === 'down'
        ? { fg: CEO.red, bg: CEO.redBg, arrow: '↓', verb: 'fell' }
        : { fg: '#64748b', bg: '#f1f5f9', arrow: '→', verb: 'held' }
  const deltaLabel = `${delta >= 0 ? '+' : ''}${delta}`
  const mid = Math.floor(scores.length / 2)
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
  const firstAvg = avg(scores.slice(0, mid))
  const secondAvg = avg(scores.slice(mid))
  const earlyN = Math.floor(scores.length / 2)
  const laterN = scores.length - earlyN
  const earlyLabel =
    earlyN <= 0 ? 'early weeks' : earlyN === 1 ? 'week 1' : `weeks 1–${earlyN}`
  const laterLabel =
    laterN <= 0
      ? 'later weeks'
      : laterN === 1
        ? `week ${earlyN + 1}`
        : `weeks ${earlyN + 1}–${scores.length}`
  const caption =
    weekCount < 2
      ? 'Need more weeks to show a trend'
      : kind === 'steady'
        ? `Score held steady: ${earlyLabel} → ${laterLabel} (${deltaLabel} pts)`
        : `Score ${tone.verb} ${Math.abs(delta)} pts (${earlyLabel} → ${laterLabel})`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-gray-500">Trend</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 text-lg font-bold tabular-nums"
              style={{ color: tone.fg }}
            >
              <span aria-hidden className="text-xl leading-none">
                {tone.arrow}
              </span>
              <span>{deltaLabel}</span>
              <span className="text-xs font-semibold text-gray-500">pts</span>
            </span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ color: tone.fg, background: tone.bg }}
            >
              {label}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-snug">{caption}</p>
        </div>
        {weekCount >= 2 ? (
          <TrendHalfBars firstAvg={firstAvg} secondAvg={secondAvg} accent={tone.fg} />
        ) : (
          <div className="h-[58px] w-[90px] rounded-lg bg-slate-50" aria-hidden />
        )}
      </div>
    </div>
  )
}

export default function EmployeeReportCeoView({
  employees,
  selected,
  memberId,
  onMemberChange,
  rangeMode,
  onRangeModeChange,
  from,
  to,
  onFromChange,
  onToChange,
  onApplyCustom,
  loading,
  report,
  score,
  findings,
  onOpenWeek,
  onOpenProject,
}: {
  employees: Employee[]
  selected: Employee
  memberId: string
  onMemberChange: (id: string) => void
  rangeMode: RangeMode
  onRangeModeChange: (m: RangeMode) => void
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onApplyCustom: () => void
  loading: boolean
  report: EmployeeReport
  score: number
  findings: string[]
  /** Open WorkDrawer for a week; optional focusDateKey scrolls to that day. */
  onOpenWeek?: (row: WeekRow, focusDateKey?: string) => void
  onOpenProject: (projectId: string | null, projectName: string) => void
}) {
  const [showTable, setShowTable] = useState(false)
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null)
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set())

  const hours = report.hours
  const snap = report.snapshot
  const scoreMeta = scoreColors(score)

  const todayKey = istDateInputValue(new Date())
  /** Week has not started yet (all days after today) — show grey placeholder on chart. */
  const isFutureWeek = (r: WeekRow) => r.startKey > todayKey
  /**
   * Week not finished yet: its Friday (IST) is still after today.
   * Uses calendar Mon–Fri, not clipped endKey (Month range ends today and would
   * otherwise treat a Wed-clipped week as complete).
   */
  const isIncompleteWeek = (r: WeekRow) => weekFridayKey(r) > todayKey

  const weekRows = useMemo(
    () => (report.weekByWeek?.rows ?? []).filter(r => r.hasWorkingDays),
    [report],
  )
  /** Finished weeks only (Friday ≤ today) — Trend / Best / Weakest. */
  const scoredWeekRows = useMemo(
    () => weekRows.filter(r => !isIncompleteWeek(r)),
    [weekRows, todayKey],
  )

  const selectedWeek = useMemo(
    () => (selectedWeekKey ? weekRows.find(r => r.startKey === selectedWeekKey) ?? null : null),
    [selectedWeekKey, weekRows],
  )

  function selectWeek(row: WeekRow) {
    if (isFutureWeek(row)) return
    setSelectedWeekKey(row.startKey)
    requestAnimationFrame(() => {
      document.getElementById('week-inline-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const groupByMonth = weekRows.length > WEEK_MONTH_GROUP_THRESHOLD
  const monthGroups = useMemo(
    () => (groupByMonth ? groupWeeksByMonth(weekRows) : []),
    [groupByMonth, weekRows],
  )

  useEffect(() => {
    if (!groupByMonth || monthGroups.length === 0) return
    setOpenMonths(prev => {
      if (prev.size > 0) return prev
      const latest = monthGroups[monthGroups.length - 1]
      return latest ? new Set([latest.key]) : prev
    })
  }, [groupByMonth, monthGroups])

  // Pick Best/Weakest among finished weeks only (ignore server badges that may flag incomplete weeks)
  const usableCompleted = (r: WeekRow) =>
    r.workingDays > 0 && r.leaveDayCount < r.workingDays && r.hoursExpected > 0
  const bestWeek =
    [...scoredWeekRows].filter(usableCompleted).sort((a, b) => b.performanceScore - a.performanceScore)[0] ??
    scoredWeekRows[0] ??
    null
  const weakWeek =
    [...scoredWeekRows].filter(usableCompleted).sort((a, b) => a.performanceScore - b.performanceScore)[0] ??
    null

  const trend = trendFromWeekScores(scoredWeekRows.map(r => r.performanceScore))

  const hoursPct =
    hours.expectedElapsed > 0 ? Math.round((hours.logged / hours.expectedElapsed) * 100) : null
  const hoursToneColors = hoursColors(hoursPct)
  const planPct = snap.planRate
  const tasksDone = report.tasksByStatus.done
  const tasksTotal = report.tasksByStatus.total
  const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : null

  const chartData = weekRows.map(r => {
    const future = isFutureWeek(r)
    return {
      key: r.startKey,
      label: r.label.replace(/–|—/, '-').split('-')[0]?.trim() ?? r.label,
      fullLabel: r.label,
      score: future ? 0 : r.performanceScore,
      hoursLogged: r.hoursLogged,
      hoursExpected: r.hoursExpected,
      planDays: r.planDays,
      workingDays: r.workingDays,
      tasksDone: r.tasksDone,
      tasksTotal: r.tasksTotal,
      badge: future ? null : r.badge,
      isFuture: future,
      fill: future
        ? '#e2e8f0'
        : r.badge === 'best'
          ? '#15803d'
          : scoreColors(r.performanceScore).fg,
    }
  })

  const projects = report.projectActivity?.summaries ?? []
  const projectsSorted = [...projects].sort((a, b) => b.hoursLogged - a.hoursLogged)
  const projectsShown = showAllProjects ? projectsSorted : projectsSorted.slice(0, 5)
  const maxProjectHours = Math.max(1, ...projectsSorted.map(p => p.hoursLogged))

  const lookAt = findings.slice(0, 4)

  const lookDot = (text: string) => {
    const t = text.toLowerCase()
    if (t.includes('on track') || t.includes('strong') || t.includes('no major')) return CEO.green
    if (t.includes('short') || t.includes('missed') || t.includes('blocker') || t.includes('weak'))
      return CEO.red
    return CEO.amber
  }

  function toggleMonth(key: string) {
    setOpenMonths(s => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  function renderWeekTableRows(rows: WeekRow[]) {
    return rows.map(r => (
      <tr
        key={r.startKey}
        className="border-b border-gray-50 hover:bg-slate-50 cursor-pointer"
        onClick={() => selectWeek(r)}
      >
        <td className="px-3 py-2.5 text-sm font-medium text-gray-900">
          <span className="inline-flex items-center gap-1.5 flex-wrap">
            {r.label}
            {r.badge === 'best' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: CEO.greenBg, color: CEO.green }}>
                Best
              </span>
            )}
            {r.badge === 'needs_improvement' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: CEO.redBg, color: CEO.red }}>
                Low
              </span>
            )}
            {r.leaveChip && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-800">
                {r.leaveChip}
              </span>
            )}
          </span>
        </td>
        <td className="px-3 py-2.5 text-sm tabular-nums text-right text-gray-800">
          {hrs(r.hoursLogged)}
          <span className="text-gray-400"> / {hrs(r.hoursExpected)}</span>
        </td>
        <td className="px-3 py-2.5 text-sm tabular-nums text-right text-gray-800">
          {r.planDays}/{r.workingDays}
        </td>
        <td className="px-3 py-2.5 text-sm tabular-nums text-right text-gray-800">
          {r.tasksTotal > 0 ? `${r.tasksDone}/${r.tasksTotal}` : '—'}
        </td>
        <td className="px-3 py-2.5 text-right">
          <span
            className="inline-flex min-w-[2.5rem] justify-center text-sm font-bold tabular-nums px-2 py-0.5 rounded-full"
            style={{
              color: scoreColors(r.performanceScore).fg,
              background: scoreColors(r.performanceScore).bg,
            }}
          >
            {r.performanceScore}
          </span>
        </td>
      </tr>
    ))
  }

  return (
    <div className="space-y-4">
      {/* 1. Filter bar */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end flex-1">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Employee</label>
            <select
              value={memberId}
              onChange={e => onMemberChange(e.target.value)}
              className="text-sm rounded-lg border border-gray-200 px-3 py-2 min-w-[200px] bg-white"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.role}
                </option>
              ))}
            </select>
          </div>
          {rangeMode === 'custom' ? (
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={e => onFromChange(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={e => onToChange(e.target.value)}
                  className="text-sm rounded-lg border border-gray-200 px-3 py-2"
                />
              </div>
              <button
                type="button"
                onClick={onApplyCustom}
                disabled={loading}
                className="rounded-lg py-2 px-4 text-sm font-semibold bg-gray-900 text-white disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date range</label>
              <p className="text-sm text-gray-800 py-2">
                {fmtDate(report.range.from)} – {fmtDate(report.range.to, true)}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap bg-gray-100 p-0.5 rounded-lg self-start lg:self-auto">
          {(
            [
              { mode: 'week' as const, label: 'Week', title: 'This week (Mon–Sun)' },
              { mode: 'month' as const, label: 'Month', title: 'Last 30 days' },
              {
                mode: 'this_month' as const,
                label: 'This month',
                title: 'Current calendar month (future weeks grey)',
              },
              { mode: 'custom' as const, label: 'Custom', title: 'Pick dates' },
            ] as const
          ).map(({ mode, label, title }) => (
            <button
              key={mode}
              type="button"
              title={title}
              onClick={() => onRangeModeChange(mode)}
              className={`px-2.5 sm:px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap ${
                rangeMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Summary hero — 50/50 with Things to look at */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-0 lg:items-stretch">
          {/* Left: score + identity */}
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center min-w-0 lg:pr-6">
            <ScoreRingBig score={score} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: scoreMeta.fg, background: scoreMeta.bg }}
                >
                  {scoreMeta.label}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    trend.kind === 'up'
                      ? 'bg-emerald-50 text-emerald-800'
                      : trend.kind === 'down'
                        ? 'bg-red-50 text-red-800'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {trend.label}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{selected.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {selected.role} · {fmtDate(report.range.from)} – {fmtDate(report.range.to, true)}
              </p>
              {snap.avgSelfScore != null && (
                <p className="text-xs text-gray-400 mt-2">
                  Avg self rating {snap.avgSelfScore}/10
                  {snap.avgFounderScore != null ? ` · Founder ${snap.avgFounderScore}/10` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Right: Things to look at */}
          <div className="min-w-0 lg:border-l lg:border-gray-100 lg:pl-6 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Things to look at</h3>
            {lookAt.length === 0 ? (
              <p className="text-sm text-gray-400">Nothing flagged this period.</p>
            ) : (
              <ul className="space-y-2">
                {lookAt.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-gray-700 leading-snug">
                    <span
                      className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                      style={{ background: lookDot(line) }}
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 3. Four key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Hours"
          value={hrs(hours.logged)}
          sub={
            hoursPct != null
              ? `${hoursPct}% of ${hrs(hours.expectedElapsed)} target`
              : `of ${hrs(hours.expectedElapsed)} target`
          }
          pct={hoursPct}
          tone={hoursPct == null ? 'neutral' : hoursPct >= 95 ? 'green' : hoursPct >= 80 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Daily plans"
          value={planPct != null ? `${planPct}%` : '—'}
          sub={`${snap.plannedDays} plans submitted`}
          pct={planPct}
          tone={planPct == null ? 'neutral' : planPct >= 85 ? 'green' : planPct >= 70 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Tasks done"
          value={tasksTotal > 0 ? `${tasksDone}/${tasksTotal}` : '—'}
          sub={taskPct != null ? `${taskPct}% complete` : 'No tasks'}
          pct={taskPct}
          tone={taskPct == null ? 'neutral' : taskPct >= 85 ? 'green' : taskPct >= 70 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Blockers"
          value={String(snap.openBlockers)}
          sub={snap.openBlockers === 0 ? 'None open' : 'Need attention'}
          pct={null}
          tone={snap.openBlockers === 0 ? 'green' : 'red'}
        />
      </div>

      {/* 4. Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          disabled={!bestWeek}
          onClick={() => bestWeek && selectWeek(bestWeek)}
          className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-emerald-300 disabled:opacity-50 disabled:hover:border-gray-200"
        >
          <p className="text-[11px] font-semibold text-emerald-700">Best week</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{bestWeek?.label ?? '—'}</p>
          {bestWeek && (
            <p className="text-xs text-gray-500 mt-1">
              Score {bestWeek.performanceScore} · {hrs(bestWeek.hoursLogged)}
            </p>
          )}
        </button>
        <button
          type="button"
          disabled={!weakWeek}
          onClick={() => weakWeek && selectWeek(weakWeek)}
          className="text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-red-300 disabled:opacity-50"
        >
          <p className="text-[11px] font-semibold text-red-700">Weakest week</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{weakWeek?.label ?? '—'}</p>
          {weakWeek && (
            <p className="text-xs text-gray-500 mt-1">
              Score {weakWeek.performanceScore} · {hrs(weakWeek.hoursLogged)}
            </p>
          )}
        </button>
        <TrendKpiCard
          kind={trend.kind}
          label={trend.label}
          delta={trend.delta}
          scores={scoredWeekRows.map(r => r.performanceScore)}
          weekCount={scoredWeekRows.length}
        />
      </div>

      {/* 5. Week by week */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Week by week</h3>
            <p className="text-xs text-gray-500 mt-0.5">Click a bar for day-by-day detail</p>
          </div>
          <button
            type="button"
            onClick={() => setShowTable(v => !v)}
            className="text-xs font-semibold text-blue-600 hover:underline"
          >
            {showTable ? 'Hide table' : 'Show table'}
          </button>
        </div>
        <div className="px-2 pt-4 pb-2 h-56">
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">No working weeks in range</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <ReferenceLine y={70} stroke="#fcd34d" strokeDasharray="4 4" />
                <ReferenceLine y={85} stroke="#86efac" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const d = payload[0].payload as (typeof chartData)[0]
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-semibold text-gray-900">{d.fullLabel}</p>
                        {d.isFuture ? (
                          <p className="text-gray-400 mt-1">Upcoming — no score yet</p>
                        ) : (
                          <>
                            <p className="text-gray-600 mt-1">Score {d.score}</p>
                            <p className="text-gray-500">
                              {hrs(d.hoursLogged)} / {hrs(d.hoursExpected)} · plans {d.planDays}/
                              {d.workingDays}
                              {d.tasksTotal > 0 ? ` · tasks ${d.tasksDone}/${d.tasksTotal}` : ''}
                            </p>
                            {d.badge === 'best' && (
                              <p className="text-emerald-700 font-semibold mt-0.5">Best</p>
                            )}
                            {d.badge === 'needs_improvement' && (
                              <p className="text-red-700 font-semibold mt-0.5">Low</p>
                            )}
                          </>
                        )}
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="score"
                  radius={[6, 6, 0, 0]}
                  onClick={(data) => {
                    const key = (data as { key?: string; isFuture?: boolean } | undefined)?.key
                    const row = key ? weekRows.find(r => r.startKey === key) : null
                    if (row) selectWeek(row)
                  }}
                >
                  {chartData.map(d => (
                    <Cell
                      key={d.key}
                      fill={d.fill}
                      cursor={d.isFuture ? 'default' : 'pointer'}
                      fillOpacity={
                        d.isFuture
                          ? 1
                          : selectedWeekKey && selectedWeekKey !== d.key
                            ? 0.35
                            : 1
                      }
                      stroke={selectedWeekKey === d.key ? '#0f172a' : undefined}
                      strokeWidth={selectedWeekKey === d.key ? 1 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {showTable && (
          <div className="border-t border-gray-100 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-wide">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Week</th>
                  <th className="text-right font-semibold px-3 py-2">Hours</th>
                  <th className="text-right font-semibold px-3 py-2">Plans</th>
                  <th className="text-right font-semibold px-3 py-2">Tasks</th>
                  <th className="text-right font-semibold px-3 py-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {!groupByMonth && renderWeekTableRows(weekRows)}
                {groupByMonth &&
                  monthGroups.flatMap(g => {
                    const open = openMonths.has(g.key)
                    return [
                      <tr
                        key={`m-${g.key}`}
                        className="bg-slate-50 cursor-pointer border-b border-slate-200"
                        onClick={() => toggleMonth(g.key)}
                      >
                        <td colSpan={5} className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className={`text-gray-400 ${open ? 'rotate-90' : ''}`}>▸</span>
                            <span className="font-bold text-gray-900">{g.label}</span>
                            <span className="text-xs text-gray-500">
                              {g.weekCount} weeks · {hrs(g.hoursLogged)}
                              {g.hoursExpected > 0 ? ` of ${hrs(g.hoursExpected)}` : ''}
                            </span>
                          </span>
                        </td>
                      </tr>,
                      ...(open ? renderWeekTableRows(g.weeks) : []),
                    ]
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. Projects in this period */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Projects in this period</h3>
          <p className="text-xs text-gray-500 mt-0.5">Sorted by hours · click for detail</p>
        </div>
        {projectsShown.length === 0 ? (
          <p className="text-sm text-gray-400 px-4 py-8 text-center">No project work logged</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {projectsShown.map(p => {
              const tag = worstProjectTag(p)
              const share = Math.round((p.hoursLogged / maxProjectHours) * 100)
              const name = !p.projectId || p.projectName === 'No project' ? 'No project' : p.projectName
              return (
                <li key={p.projectId ?? name}>
                  <button
                    type="button"
                    onClick={() => onOpenProject(p.projectId, p.projectName)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">{name}</span>
                        {tag && (
                          <span
                            className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              color: tag.tone === 'red' ? CEO.red : CEO.amber,
                              background: tag.tone === 'red' ? CEO.redBg : CEO.amberBg,
                            }}
                          >
                            {tag.label}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden max-w-md">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(share, 2)}%`, background: CEO.blue }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-gray-800 shrink-0">
                      {hrs(p.hoursLogged)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {projectsSorted.length > 5 && (
          <div className="px-4 py-2.5 border-t border-gray-100">
            <button
              type="button"
              className="text-xs font-semibold text-blue-600 hover:underline"
              onClick={() => setShowAllProjects(v => !v)}
            >
              {showAllProjects ? 'Show less' : `Show all ${projectsSorted.length} projects`}
            </button>
          </div>
        )}
      </section>
      <section  className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {selectedWeek && (
          <div id="week-inline-detail">
            <WeekInlinePanel
              week={selectedWeek}
              weekRows={weekRows}
              employeeName={selected.name}
              hoursByDay={report.hours.byDay}
              onSelectWeek={selectWeek}
              onClose={() => setSelectedWeekKey(null)}
              onDayBarClick={
                onOpenWeek
                  ? (dateKey) => onOpenWeek(selectedWeek, dateKey)
                  : undefined
              }
            />
          </div>
        )}
      </section>


      {/* 8. Leave */}
      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Leave</h3>
          <Link href="/leaves/usage" className="text-xs font-semibold text-blue-600 hover:underline">
            Full usage →
          </Link>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-xl font-bold text-gray-900">
                {report.leaves.fullDayCount +
                  report.leaves.birthdayLeaveCount +
                  report.leaves.compOffLeaveCount}
              </p>
              <p className="text-[11px] font-semibold text-gray-500">Leaves</p>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ background: CEO.amberBg }}>
              <p className="text-xl font-bold" style={{ color: CEO.amber }}>
                {report.leaves.halfDayCount}
              </p>
              <p className="text-[11px] font-semibold" style={{ color: CEO.amber }}>
                Half days
              </p>
            </div>
            <div className="rounded-lg bg-sky-50 px-3 py-2.5">
              <p className="text-xl font-bold text-sky-900">{report.leaves.shortLeaveCount}</p>
              <p className="text-[11px] font-semibold text-sky-700">Short leaves</p>
            </div>
          </div>
          {report.leaves.leaves.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-50 border-t border-gray-100">
              {report.leaves.leaves.slice(0, 6).map(l => (
                <li key={l.id} className="py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize text-gray-800">
                    {l.leaveType.replace(/_/g, ' ')}
                    {l.timeSlot ? ` · ${l.timeSlot.replace(/_/g, ' ')}` : ''}
                  </span>
                  <span className="text-xs text-gray-500 shrink-0">{fmtDate(l.startDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
