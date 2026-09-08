'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import toast, { Toaster } from 'react-hot-toast'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { EmployeeReport } from '@/lib/employee-report'

type Employee = { id: string; name: string; email: string; role: string }
type RangeMode = 'week' | 'month' | 'custom'

function toInputDate(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

function fmtDate(iso: string, pattern = 'MMM d') {
  return format(new Date(iso), pattern)
}

function hrs(n: number | null | undefined) {
  if (n == null) return '—'
  return `${Number(n.toFixed(1))}h`
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n))
}

/** Simple SVG donut for score-out-of-100 style metrics */
function ScoreRing({
  value,
  label,
  color,
  center,
}: {
  value: number | null
  label: string
  color: string
  center?: string
}) {
  const v = value == null ? 0 : clamp(value)
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (v / 100) * c
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[88px]">
      <div className="relative w-[80px] h-[80px]">
        <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={value == null ? c : offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900">
            {value == null ? '—' : center ?? String(Math.round(v))}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 text-center leading-tight max-w-[96px]">
        {label}
      </span>
    </div>
  )
}

function ReportGeneratingLoader() {
  const [pct, setPct] = useState(6)

  useEffect(() => {
    const id = window.setInterval(() => {
      setPct(p => {
        if (p >= 90) return 90
        return Math.min(90, p + 4 + Math.random() * 8)
      })
    }, 180)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 px-6 py-16 flex flex-col items-center text-center">
      <p className="text-sm font-semibold text-gray-900">Report generating…</p>
      <p className="text-xs text-gray-500 mt-1">Pulling hours, plans, projects, and scores</p>
      <div className="w-full max-w-md mt-5 h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-slate-900 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs font-medium tabular-nums text-gray-400 mt-2">{Math.round(pct)}%</p>
    </div>
  )
}

function ProgressPill({
  label,
  current,
  total,
  color,
}: {
  label: string
  current: number
  total: number
  color: string
}) {
  const pct = total > 0 ? clamp((current / total) * 100) : 0
  return (
    <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-3 text-center">
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>
        {current}
        <span className="text-gray-300 font-semibold">/{total || 0}</span>
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mt-1">{label}</p>
      <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
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
    active: 'bg-blue-50 text-blue-800',
    on_hold: 'bg-amber-50 text-amber-800',
    qa: 'bg-violet-50 text-violet-800',
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

function flagLabel(flag: string) {
  switch (flag) {
    case 'no_plan':
      return 'No plan'
    case 'under_planned':
      return 'Short on plan'
    case 'no_eod':
      return 'No EOD'
    case 'under_logged':
      return 'Hours short'
    case 'on_leave':
      return 'Leave'
    case 'upcoming':
      return 'Upcoming'
    case 'today':
      return 'Today'
    case 'today_no_plan':
      return 'Today · no plan'
    default:
      return flag
  }
}

function buildFindings(report: EmployeeReport): string[] {
  const findings: string[] = []
  const { hours, snapshot } = report

  if (hours.loggedShort >= 4) {
    findings.push(
      `Hours gap: ${hrs(hours.logged)} logged vs ${hrs(hours.expectedElapsed)} expected so far — missing ${hrs(hours.loggedShort)}.`
    )
  } else if (hours.loggedShort >= 1) {
    findings.push(`Slightly under hours — short ${hrs(hours.loggedShort)} so far.`)
  } else if (hours.expectedElapsed > 0) {
    findings.push(`Hours on track — ${hrs(hours.logged)} of ${hrs(hours.expectedElapsed)} expected so far.`)
  }

  if (hours.plannedShort >= 4) {
    findings.push(
      `Morning plans under-filled by ${hrs(hours.plannedShort)} (target ${hours.dayTarget}h/day).`
    )
  }

  const noPlanDays = hours.byDay.filter(d => d.flags.includes('no_plan')).length
  if (noPlanDays > 0) {
    findings.push(`${noPlanDays} day${noPlanDays === 1 ? '' : 's'} with no morning plan.`)
  }

  if (snapshot.eodMissed > 0) {
    findings.push(`${snapshot.eodMissed} EOD${snapshot.eodMissed === 1 ? '' : 's'} missed after a plan was submitted.`)
  }

  if (snapshot.openBlockers > 0) {
    findings.push(`${snapshot.openBlockers} open blocker${snapshot.openBlockers === 1 ? '' : 's'} need attention.`)
  }

  if ((snapshot.planRate ?? 100) < 70) {
    findings.push(
      `Plan cadence weak — only ${snapshot.plannedDays} plan${snapshot.plannedDays === 1 ? '' : 's'} in so far.`
    )
  }

  if (snapshot.avgSelfScore != null && snapshot.avgSelfScore < 7) {
    findings.push(`Self score average is ${snapshot.avgSelfScore}/10 — review weekly check-in.`)
  } else if (snapshot.avgSelfScore != null && snapshot.avgSelfScore >= 8.5) {
    findings.push(`Strong self scores this period (avg ${snapshot.avgSelfScore}/10).`)
  }

  if (findings.length === 0) {
    findings.push('No major flags in this period. Keep the cadence.')
  }

  return findings.slice(0, 6)
}

function overallScore(report: EmployeeReport): number {
  const hoursPct = report.hours.expectedElapsed > 0
    ? clamp((report.hours.logged / report.hours.expectedElapsed) * 100)
    : 70
  const planPct = report.snapshot.planRate ?? 50
  const eodPct = report.snapshot.eodRate ?? 50
  const completion = report.snapshot.avgCompletionRate ?? 50
  const self = report.snapshot.avgSelfScore != null ? report.snapshot.avgSelfScore * 10 : 70
  return Math.round(
    hoursPct * 0.3 + planPct * 0.2 + eodPct * 0.2 + completion * 0.15 + self * 0.15
  )
}

export default function EmployeeReportClient({ employees }: { employees: Employee[] }) {
  const [memberId, setMemberId] = useState(employees[0]?.id || '')
  const [rangeMode, setRangeMode] = useState<RangeMode>('week')
  const [from, setFrom] = useState(
    toInputDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
  )
  const [to, setTo] = useState(toInputDate(endOfWeek(new Date(), { weekStartsOn: 1 })))
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<EmployeeReport | null>(null)
  const requestId = useRef(0)

  const selected = useMemo(
    () => employees.find(e => e.id === memberId) || null,
    [employees, memberId]
  )

  async function loadReport(
    nextMemberId = memberId,
    nextRange: RangeMode = rangeMode,
    nextFrom = from,
    nextTo = to
  ) {
    if (!nextMemberId) return
    const id = ++requestId.current
    setLoading(true)
    setReport(null)
    try {
      const params = new URLSearchParams({ memberId: nextMemberId, range: nextRange })
      if (nextRange === 'custom') {
        params.set('from', nextFrom)
        params.set('to', nextTo)
      }
      const res = await fetch(`/api/reports/employee?${params}`)
      const json = await res.json()
      if (id !== requestId.current) return
      if (!res.ok) throw new Error(json.error || 'Failed to load report')
      setReport(json)
    } catch (e: unknown) {
      if (id !== requestId.current) return
      toast.error(e instanceof Error ? e.message : 'Failed to load report')
      setReport(null)
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!memberId) return
    let nextFrom = from
    let nextTo = to
    if (rangeMode === 'week') {
      nextFrom = toInputDate(startOfWeek(new Date(), { weekStartsOn: 1 }))
      nextTo = toInputDate(endOfWeek(new Date(), { weekStartsOn: 1 }))
      setFrom(nextFrom)
      setTo(nextTo)
    } else if (rangeMode === 'month') {
      nextFrom = toInputDate(startOfMonth(new Date()))
      nextTo = toInputDate(endOfMonth(new Date()))
      setFrom(nextFrom)
      setTo(nextTo)
    }
    void loadReport(memberId, rangeMode, nextFrom, nextTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, rangeMode])

  const hours = report?.hours
  const snap = report?.snapshot
  const score = report ? overallScore(report) : null
  const findings = report ? buildFindings(report) : []
  const latestSelf = report?.scores.self[0]
  const latestFounder = report?.scores.founder.find(
    f => latestSelf && f.weekOf.slice(0, 10) === latestSelf.weekOf.slice(0, 10)
  )

  const chartData =
    hours?.byDay
      .filter(d => d.expected > 0)
      .map(d => {
        const remainingToday =
          d.phase === 'today' ? Math.max(0, Math.round((d.expected - d.logged) * 10) / 10) : 0
        return {
          label: fmtDate(d.date, 'EEE d'),
          logged: d.logged,
          missing: d.loggedShort,
          remaining: remainingToday,
          upcoming: d.phase === 'future' ? d.expected : 0,
          expected: d.expected,
          flag: d.flags[0] || '',
          phase: d.phase,
        }
      }) ?? []

  const projectsActive = report
    ? [...report.projects.asDev, ...report.projects.asBd].filter(p =>
        ['active', 'qa', 'on_hold'].includes(p.status)
      ).length
    : 0

  const elapsedBizDays =
    hours?.byDay.filter(d => d.phase === 'past' && d.expected > 0).length ?? 0
  const periodBizDays = hours?.byDay.filter(d => d.expected > 0).length ?? 0

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Toaster position="top-right" />

      {/* Controls */}
      <div className="mb-4 flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
        <div>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-700">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Employee performance report</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">
              Employee
            </label>
            <select
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              className="text-sm rounded-lg border-gray-200 px-3 py-2 min-w-[200px]"
            >
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.role}
                </option>
              ))}
            </select>
          </div>
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            {(['week', 'month', 'custom'] as RangeMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setRangeMode(mode)}
                className={`px-3 py-2 rounded-md text-sm font-semibold capitalize ${
                  rangeMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                } ${loading ? 'opacity-70' : ''}`}
              >
                {mode === 'week' ? 'Week' : mode === 'month' ? 'Month' : 'Custom'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rangeMode === 'custom' && (
        <div className="mb-4 flex flex-wrap gap-2 items-end bg-white rounded-xl ring-1 ring-gray-900/5 p-3">
          <div>
            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="text-sm rounded-lg border-gray-200 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="text-sm rounded-lg border-gray-200 px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={() => loadReport()}
            disabled={loading}
            className="rounded-lg py-2 px-4 text-sm font-bold bg-slate-900 text-white disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <ReportGeneratingLoader />
      ) : report && hours && snap && selected ? (
        <div className="space-y-4">
          {/* Hero: name + overall score */}
          <div className="rounded-2xl bg-slate-900 text-white px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {selected.role} · {fmtDate(report.range.from)} – {fmtDate(report.range.to, 'MMM d, yyyy')}
              </p>
              <h2 className="text-3xl font-bold tracking-tight mt-1">{selected.name}</h2>
              <p className="text-sm text-slate-300 mt-1">
                {hrs(hours.logged)} logged · {snap.plannedDays} plans · {snap.eodDays} EODs ·{' '}
                {report.tasksByStatus.done}/{report.tasksByStatus.total} tasks done
              </p>
            </div>
            <div className="text-center sm:text-right shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Overall performance
              </p>
              <p
                className={`text-5xl font-bold tabular-nums ${
                  (score ?? 0) >= 80
                    ? 'text-emerald-400'
                    : (score ?? 0) >= 60
                      ? 'text-amber-300'
                      : 'text-red-300'
                }`}
              >
                {score}
                <span className="text-xl text-slate-500 font-semibold">/100</span>
              </p>
            </div>
          </div>

          {/* Color KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl bg-blue-600 text-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-100">
                Hours logged
              </p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{hrs(hours.logged)}</p>
              <p className="text-xs text-blue-100 mt-1">
                of {hrs(hours.expectedElapsed)} so far
                {hours.expected > hours.expectedElapsed
                  ? ` · ${hrs(hours.expected)} period`
                  : ''}
              </p>
            </div>
            <div
              className={`rounded-xl p-4 text-white ${
                hours.loggedShort >= 1 ? 'bg-red-600' : 'bg-emerald-600'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                Hours missing
              </p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{hrs(hours.loggedShort)}</p>
              <p className="text-xs text-white/80 mt-1">
                {hours.loggedShort >= 1 ? 'Below 8h/day target' : 'On track'}
              </p>
            </div>
            <div className="rounded-xl bg-violet-600 text-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-100">
                Plan cadence
              </p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{snap.planRate ?? 0}%</p>
              <p className="text-xs text-violet-100 mt-1">
                {snap.plannedDays}/{elapsedBizDays || report.range.expectedBusinessDays} days so far
                {periodBizDays > elapsedBizDays ? ` · ${periodBizDays} in period` : ''}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500 text-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                Open blockers
              </p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{snap.openBlockers}</p>
              <p className="text-xs text-amber-100 mt-1">{projectsActive} active projects</p>
            </div>
          </div>

          {/* Rings + findings */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <section className="rounded-xl bg-white ring-1 ring-gray-900/5 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">
                Period health
              </h3>
              <div className="flex flex-wrap justify-around gap-4">
                <ScoreRing
                  label="Hours"
                  value={hours.utilisationPct}
                  color="#2563eb"
                />
                <ScoreRing label="Plans" value={snap.planRate} color="#7c3aed" />
                <ScoreRing label="EOD" value={snap.eodRate} color="#059669" />
                <ScoreRing
                  label="Done"
                  value={snap.avgCompletionRate}
                  color="#d97706"
                />
                <ScoreRing
                  label="How was your day?"
                  value={
                    snap.avgDayRating != null
                      ? Math.round((snap.avgDayRating / 5) * 100)
                      : null
                  }
                  center={snap.avgDayRating != null ? `${snap.avgDayRating}/5` : undefined}
                  color="#e11d48"
                />
              </div>

              {latestSelf && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                    Latest weekly score · week of {fmtDate(latestSelf.weekOf)}
                  </p>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {(
                      [
                        ['Delivery', latestSelf.delivery, latestFounder?.delivery],
                        ['Process', latestSelf.process, latestFounder?.process],
                        ['Comm', latestSelf.communication, latestFounder?.communication],
                        ['Growth', latestSelf.growth, latestFounder?.growth],
                        ['Culture', latestSelf.culture, latestFounder?.culture],
                      ] as const
                    ).map(([label, selfV, foundV]) => (
                      <div key={label} className="rounded-lg bg-slate-50 py-2 px-1">
                        <p className="text-[9px] font-semibold uppercase text-gray-400">{label}</p>
                        <p className="text-lg font-bold text-gray-900">{selfV}</p>
                        {foundV != null && (
                          <p className="text-[10px] text-slate-500">F {foundV}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="rounded-xl bg-slate-50 ring-1 ring-slate-200 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600 mb-3">
                Key findings
              </h3>
              <ul className="space-y-2.5">
                {findings.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700 leading-snug">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                        f.toLowerCase().includes('gap') ||
                        f.toLowerCase().includes('miss') ||
                        f.toLowerCase().includes('weak') ||
                        f.toLowerCase().includes('blocker') ||
                        f.toLowerCase().includes('under')
                          ? 'bg-red-500'
                          : f.toLowerCase().includes('on track') ||
                              f.toLowerCase().includes('strong')
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                      }`}
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </aside>
          </div>

          {/* Progress ratios */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2 px-0.5">
              Progress snapshot
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <ProgressPill
                label="Hours"
                current={Math.round(hours.logged)}
                total={Math.round(hours.expectedElapsed) || 0}
                color="#2563eb"
              />
              <ProgressPill
                label="Plans"
                current={snap.plannedDays}
                total={elapsedBizDays || report.range.expectedBusinessDays}
                color="#7c3aed"
              />
              <ProgressPill
                label="EODs"
                current={snap.eodDays}
                total={Math.max(snap.plannedDays, 1)}
                color="#059669"
              />
              <ProgressPill
                label="Tasks done"
                current={report.tasksByStatus.done}
                total={report.tasksByStatus.total || 1}
                color="#d97706"
              />
              <ProgressPill
                label="Goals active"
                current={snap.activeGoals}
                total={Math.max(report.goals.length, 1)}
                color="#e11d48"
              />
            </div>
          </div>

          {/* Hours chart + day table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl bg-white ring-1 ring-gray-900/5 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                Hours by day
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Blue = logged · Red = missing (past days) · Light = still today · Grey = upcoming
              </p>
              <div className="h-52">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">
                    No weekdays in range yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: rangeMode === 'month' ? 9 : 10, fill: '#94a3b8' }}
                        interval={rangeMode === 'month' ? 1 : 0}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        allowDecimals={false}
                        domain={[0, hours.dayTarget]}
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        formatter={(value: number, name: string) => {
                          if (!value) return [null, null]
                          const names: Record<string, string> = {
                            logged: 'Logged',
                            missing: 'Missing',
                            remaining: 'Left today',
                            upcoming: 'Upcoming',
                          }
                          return [`${value}h`, names[name] ?? name]
                        }}
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload as
                            | { expected?: number; flag?: string }
                            | undefined
                          return `${label} · need ${row?.expected ?? hours.dayTarget}h`
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value: string) =>
                          value === 'logged'
                            ? 'Logged'
                            : value === 'missing'
                              ? 'Missing'
                              : value === 'remaining'
                                ? 'Left today'
                                : 'Upcoming'
                        }
                      />
                      <Bar
                        dataKey="logged"
                        name="logged"
                        stackId="hours"
                        fill="#2563eb"
                        maxBarSize={rangeMode === 'month' ? 12 : 22}
                      />
                      <Bar
                        dataKey="missing"
                        name="missing"
                        stackId="hours"
                        fill="#ef4444"
                        maxBarSize={rangeMode === 'month' ? 12 : 22}
                      />
                      <Bar
                        dataKey="remaining"
                        name="remaining"
                        stackId="hours"
                        fill="#93c5fd"
                        maxBarSize={rangeMode === 'month' ? 12 : 22}
                      />
                      <Bar
                        dataKey="upcoming"
                        name="upcoming"
                        stackId="hours"
                        fill="#e2e8f0"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={rangeMode === 'month' ? 12 : 22}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>

            <section className="rounded-xl bg-white ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Where are the hours?
                </h3>
              </div>
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-[10px] uppercase text-gray-400 border-b border-gray-100">
                      <th className="text-left font-semibold px-3 py-2">Day</th>
                      <th className="text-right font-semibold px-2 py-2">Need</th>
                      <th className="text-right font-semibold px-2 py-2">Got</th>
                      <th className="text-right font-semibold px-2 py-2">Short</th>
                      <th className="text-left font-semibold px-3 py-2">Flag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {hours.byDay.map(d => {
                      const short = d.phase === 'past' && d.loggedShort >= 1
                      const flag = d.flags[0]
                      return (
                        <tr key={d.date} className={short ? 'bg-red-50/50' : d.phase === 'today' ? 'bg-blue-50/40' : undefined}>
                          <td className="px-3 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                            {fmtDate(d.date, 'EEE d')}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-500">{hrs(d.expected)}</td>
                          <td className="px-2 py-1.5 text-right font-semibold">{hrs(d.logged)}</td>
                          <td
                            className={`px-2 py-1.5 text-right font-bold ${
                              short ? 'text-red-600' : 'text-gray-300'
                            }`}
                          >
                            {short ? hrs(d.loggedShort) : '—'}
                          </td>
                          <td className="px-3 py-1.5">
                            <span
                              className={`text-[10px] font-bold ${
                                short || flag === 'no_plan' || flag === 'no_eod' || flag === 'under_logged'
                                  ? 'text-red-700'
                                  : flag === 'upcoming'
                                    ? 'text-gray-400'
                                    : flag === 'today' || flag === 'today_no_plan'
                                      ? 'text-blue-700'
                                      : 'text-emerald-600'
                              }`}
                            >
                              {flag ? flagLabel(flag) : 'OK'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs font-semibold text-gray-600 flex justify-between">
                <span>
                  Total {hrs(hours.logged)} / {hrs(hours.expectedElapsed)} so far
                  {hours.expected > hours.expectedElapsed ? ` (${hrs(hours.expected)} period)` : ''}
                </span>
                <span className={hours.loggedShort > 0 ? 'text-red-700' : 'text-emerald-700'}>
                  {hours.loggedShort > 0 ? `Missing ${hrs(hours.loggedShort)}` : 'Covered'}
                </span>
              </div>
            </section>
          </div>

          {/* Project activity — hours & tasks from daily plans */}
          <section className="rounded-xl bg-white ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Project activity
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Time invested on each project from daily tasks
                </p>
              </div>
              <span className="text-[11px] text-gray-400">
                {report.tasksByStatus.done} done · {report.tasksByStatus.partial} partial ·{' '}
                {report.tasksByStatus.planned} planned · {report.tasksByStatus.moved} moved ·{' '}
                {hrs(hours.logged)} logged
              </span>
            </div>

            {report.projectActivity.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No project tasks in this period.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {report.projectActivity.map(p => (
                  <div key={p.projectId ?? 'none'} className="px-4 py-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      {p.projectId ? (
                        <Link
                          href={`/projects/${p.projectId}`}
                          className="text-base font-semibold text-gray-900 hover:text-blue-600"
                        >
                          {p.projectName}
                        </Link>
                      ) : (
                        <span className="text-base font-semibold text-gray-500">{p.projectName}</span>
                      )}
                      <span className="text-lg font-bold tabular-nums text-gray-900">
                        {hrs(p.hoursLogged)}
                        <span className="text-xs font-medium text-gray-400 ml-1">
                          logged / {hrs(p.hoursPlanned)} planned
                        </span>
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-3">
                      <div className="rounded-lg bg-emerald-50 px-2 py-2 text-center">
                        <p className="text-lg font-bold text-emerald-800">{p.done}</p>
                        <p className="text-[10px] font-semibold uppercase text-emerald-700">Done</p>
                      </div>
                      <div className="rounded-lg bg-blue-50 px-2 py-2 text-center">
                        <p className="text-lg font-bold text-blue-800">{p.planned}</p>
                        <p className="text-[10px] font-semibold uppercase text-blue-700">Planned</p>
                      </div>
                      <div className="rounded-lg bg-amber-50 px-2 py-2 text-center">
                        <p className="text-lg font-bold text-amber-800">{p.partial}</p>
                        <p className="text-[10px] font-semibold uppercase text-amber-700">Partial</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-2 text-center">
                        <p className="text-lg font-bold text-slate-800">{p.moved}</p>
                        <p className="text-[10px] font-semibold uppercase text-slate-600">Moved</p>
                      </div>
                    </div>

                    <ul className="space-y-1.5">
                      {p.tasks.map(t => (
                        <li key={t.id} className="flex items-center gap-2 text-sm">
                          {statusBadge(t.status)}
                          <span className="text-gray-700 flex-1 min-w-0 truncate">{t.title}</span>
                          <span className="text-xs tabular-nums text-gray-500 shrink-0">
                            {t.hours > 0 ? `${t.hours}h` : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bottom grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-xl bg-white ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Deadlines, blunders & blockers
                </h3>
              </div>
              {report.issues.length === 0 && report.blockers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">
                  No missed deadlines, blunders, or blockers.
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {report.issues.map((issue, i) => (
                    <li key={`${issue.kind}-${issue.date}-${i}`} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            issue.kind === 'deadline'
                              ? 'bg-red-50 text-red-800'
                              : issue.kind === 'blunder'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-orange-50 text-orange-800'
                          }`}
                        >
                          {issue.kind === 'deadline'
                            ? 'Deadline missed'
                            : issue.kind === 'blunder'
                              ? 'Blunder'
                              : 'At risk'}
                        </span>
                        {issue.date && (
                          <span className="text-[10px] text-gray-400">{fmtDate(issue.date)}</span>
                        )}
                      </div>
                      {issue.href ? (
                        <Link href={issue.href} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                          {issue.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-gray-900">{issue.title}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{issue.detail}</p>
                    </li>
                  ))}
                  {report.blockers.map(b => (
                    <li key={b.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        {statusBadge(b.status)}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          Blocker
                        </span>
                        <span className="text-[10px] text-gray-400">{fmtDate(b.raisedAt)}</span>
                      </div>
                      <p className="text-sm text-gray-800">{b.description}</p>
                      {b.project && (
                        <Link href={`/projects/${b.project.id}`} className="text-xs text-blue-600 hover:underline">
                          {b.project.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white ring-1 ring-gray-900/5 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Leave</h3>
                <Link href="/leaves/usage" className="text-[11px] font-semibold text-blue-600 hover:underline">
                  Full usage →
                </Link>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2.5">
                    <p className="text-xl font-bold text-gray-900">{report.leaves.fullDayCount}</p>
                    <p className="text-[10px] font-semibold uppercase text-gray-500">Full day</p>
                    <p className="text-[11px] text-gray-400">{report.leaves.fullDayDays} day(s)</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2.5">
                    <p className="text-xl font-bold text-amber-900">{report.leaves.halfDayCount}</p>
                    <p className="text-[10px] font-semibold uppercase text-amber-700">Half day</p>
                    <p className="text-[11px] text-amber-700/70">{report.leaves.halfDayDays} day(s)</p>
                  </div>
                  <div className="rounded-lg bg-sky-50 px-3 py-2.5">
                    <p className="text-xl font-bold text-sky-900">{report.leaves.shortLeaveCount}</p>
                    <p className="text-[10px] font-semibold uppercase text-sky-700">Short leave</p>
                    <p className="text-[11px] text-sky-700/70">2 hours each</p>
                  </div>
                  <div className="rounded-lg bg-violet-50 px-3 py-2.5">
                    <p className="text-xl font-bold text-violet-900">{report.leaves.workFromHomeCount}</p>
                    <p className="text-[10px] font-semibold uppercase text-violet-700">Work from home</p>
                  </div>
                  <div className="rounded-lg bg-pink-50 px-3 py-2.5">
                    <p className="text-xl font-bold text-pink-900">{report.leaves.birthdayLeaveCount}</p>
                    <p className="text-[10px] font-semibold uppercase text-pink-700">Birthday</p>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
                    <p className="text-xl font-bold text-emerald-900">
                      {report.leaveBalance
                        ? Math.max(0, report.leaveBalance.accrued - report.leaveBalance.used)
                        : '—'}
                    </p>
                    <p className="text-[10px] font-semibold uppercase text-emerald-700">Balance left</p>
                    {report.leaveBalance && (
                      <p className="text-[11px] text-emerald-700/70">
                        {report.leaveBalance.used} used of {report.leaveBalance.accrued}
                      </p>
                    )}
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
        </div>
      ) : (
        <div className="rounded-xl bg-white ring-1 ring-gray-900/5 py-12 text-center text-sm text-gray-500">
          Select an employee to view their report.
        </div>
      )}
    </div>
  )
}
