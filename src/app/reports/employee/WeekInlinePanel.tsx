'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { EmployeeReport } from '@/lib/employee-report'
import { CEO, scoreColors, worstProjectTag } from './ceo-report-helpers'
import { PROJECT_BAR_COLORS } from './WorkDrawer'

type WeekRow = NonNullable<EmployeeReport['weekByWeek']>['rows'][number]
type DayHours = EmployeeReport['hours']['byDay'][number]

function hrs(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  const v = Math.round(n * 10) / 10
  return `${v}h`
}

function eachDateKeys(startKey: string, endKey: string): string[] {
  const keys: string[] = []
  let [y, m, d] = startKey.split('-').map(Number)
  while (true) {
    const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (key > endKey) break
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

/** Compact chart axis label: "Mon 14" */
function chartDayLabel(dateKey: string) {
  const day = Number(dateKey.split('-')[2])
  return `${weekdayShort(dateKey)} ${day}`
}

/** Two-line X tick: Mon / 14 — centered under each bar */
function ChartDayTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value?: string | number }
}) {
  const raw = String(payload?.value ?? '')
  const [wd, day] = raw.split(' ')
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#94a3b8" fontSize={11}>
        <tspan x={0} dy={11}>
          {wd}
        </tspan>
        {day ? (
          <tspan x={0} dy={12} fontSize={10}>
            {day}
          </tspan>
        ) : null}
      </text>
    </g>
  )
}

/** Plot-area inset matching BarChart YAxis + margins (keep leave pills under bars). */
const CHART_PLOT_PAD = { left: 28, right: 8 }

export default function WeekInlinePanel({
  week,
  weekRows,
  employeeName,
  hoursByDay,
  onSelectWeek,
  onClose,
  onDayBarClick,
}: {
  week: WeekRow
  weekRows: WeekRow[]
  employeeName: string
  hoursByDay: DayHours[]
  onSelectWeek: (row: WeekRow) => void
  onClose: () => void
  /** Open sidebar with this week's day-by-day; prefer scrolling to dateKey. */
  onDayBarClick?: (dateKey: string) => void
}) {
  const idx = weekRows.findIndex(r => r.startKey === week.startKey)
  const prev = idx > 0 ? weekRows[idx - 1] : null
  const next = idx >= 0 && idx < weekRows.length - 1 ? weekRows[idx + 1] : null

  const scoreMeta = scoreColors(week.performanceScore)
  const hoursPct =
    week.hoursExpected > 0 ? Math.round((week.hoursLogged / week.hoursExpected) * 100) : null

  const hoursByKey = useMemo(() => {
    const m = new Map<string, DayHours>()
    for (const d of hoursByDay) m.set(d.dateKey, d)
    return m
  }, [hoursByDay])

  const metaByKey = useMemo(() => {
    const m = new Map(week.dayMeta.map(d => [d.dateKey, d]))
    return m
  }, [week.dayMeta])

  // Active projects for colours (hours > 0 or tasks)
  const activeProjects = useMemo(() => {
    return [...week.projects]
      .filter(p => p.hoursLogged > 0 || p.tasks.length > 0)
      .sort((a, b) => b.hoursLogged - a.hoursLogged)
  }, [week.projects])

  const colorByKey = useMemo(() => {
    const map = new Map<string, string>()
    activeProjects.forEach((p, i) => {
      map.set(p.projectId ?? '__none__', PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length])
    })
    return map
  }, [activeProjects])

  const dateKeys = useMemo(() => eachDateKeys(week.startKey, week.endKey), [week.startKey, week.endKey])

  // Stacked chart data: Mon–Fri; Sat/Sun only if hours > 0
  const stackData = useMemo(() => {
    // Top 5 projects + Other for chart keys
    const top = activeProjects.slice(0, 5)
    const topKeys = new Set(top.map(p => p.projectId ?? '__none__'))
    const rows = dateKeys.map(dateKey => {
      const wd = weekdayShort(dateKey)
      const meta = metaByKey.get(dateKey)
      const hd = hoursByKey.get(dateKey)
      const leave = Boolean(meta?.isHoliday || meta?.isFullDayLeave)
      const row: Record<string, string | number | boolean | null> = {
        dateKey,
        label: chartDayLabel(dateKey),
        isWeekend: wd === 'Sat' || wd === 'Sun',
        leave,
        leaveLabel:
          meta?.leaveBadge ||
          (meta?.isHoliday
            ? meta.holidayName
              ? `Holiday · ${meta.holidayName}`
              : 'Holiday'
            : meta?.isFullDayLeave
              ? 'Leave'
              : null),
        hasPlan: hd?.hasPlan ?? false,
        hasEod: hd?.hasEod ?? false,
        expected: hd?.expected ?? 0,
        missingPlan: Boolean(hd && hd.expected > 0 && hd.phase !== 'future' && !hd.hasPlan),
        missingEod: Boolean(
          hd && hd.expected > 0 && hd.phase === 'past' && hd.hasPlan && !hd.hasEod,
        ),
      }
      let other = 0
      for (const p of week.projects) {
        const pKey = p.projectId ?? '__none__'
        const hours = p.tasks
          .filter(t => t.dateKey === dateKey)
          .reduce((s, t) => s + t.hours, 0)
        if (hours <= 0) continue
        if (topKeys.has(pKey)) {
          row[pKey] = Math.round(hours * 10) / 10
        } else {
          other += hours
        }
      }
      if (other > 0) row.__other__ = Math.round(other * 10) / 10
      // Off marker for empty weekend / empty weekday with no leave
      const workSum = top.reduce((s, p) => s + (Number(row[p.projectId ?? '__none__']) || 0), 0) + other
      row._empty = workSum <= 0
      row._hours = Math.round(workSum * 10) / 10
      return row
    })
    return rows.filter(r => !r.isWeekend || Number(r._hours) > 0)
  }, [dateKeys, activeProjects, week.projects, metaByKey, hoursByKey])

  const stackKeys = useMemo(() => {
    const keys = activeProjects.slice(0, 5).map(p => p.projectId ?? '__none__')
    if (stackData.some(d => Number(d.__other__ || 0) > 0)) keys.push('__other__')
    return keys
  }, [activeProjects, stackData])

  const legendItems = useMemo(() => {
    return stackKeys.map((k, i) => {
      if (k === '__other__') return { key: k, name: 'Other', color: '#94a3b8' }
      const p = activeProjects.find(x => (x.projectId ?? '__none__') === k)
      return {
        key: k,
        name: !p || !p.projectId || p.projectName === 'No project' ? 'No project' : p.projectName,
        color: colorByKey.get(k) ?? PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length],
      }
    })
  }, [stackKeys, activeProjects, colorByKey])

  // Mini table Mon–Fri
  const weekdays = dateKeys.filter(k => {
    const wd = weekdayShort(k)
    return wd !== 'Sat' && wd !== 'Sun'
  })

  return (
    <div className="border-t border-gray-200 bg-slate-50/60">
      {/* Header */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between border-b border-gray-100 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            disabled={!prev}
            onClick={() => prev && onSelectWeek(prev)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm font-semibold text-gray-700 disabled:opacity-40 hover:bg-slate-50"
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            type="button"
            disabled={!next}
            onClick={() => next && onSelectWeek(next)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-sm font-semibold text-gray-700 disabled:opacity-40 hover:bg-slate-50"
            aria-label="Next week"
          >
            ›
          </button>
          <div className="min-w-0 ml-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-bold text-gray-900">{week.label}</h4>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                style={{ color: scoreMeta.fg, background: scoreMeta.bg }}
              >
                {week.performanceScore}
              </span>
              {week.badge === 'best' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: CEO.greenBg, color: CEO.green }}>
                  Best
                </span>
              )}
              {week.badge === 'needs_improvement' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: CEO.redBg, color: CEO.red }}>
                  Low
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{employeeName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          Close
        </button>
      </div>

      {/* Four cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-4">
        {[
          {
            label: 'Total hours',
            value: hrs(week.hoursLogged),
            sub: hoursPct != null ? `${hoursPct}% of ${hrs(week.hoursExpected)}` : `of ${hrs(week.hoursExpected)}`,
          },
          {
            label: 'Projects',
            value: String(activeProjects.length),
            sub: 'with time this week',
          },
          {
            label: 'Tasks done',
            value: week.tasksTotal > 0 ? `${week.tasksDone}/${week.tasksTotal}` : '—',
            sub: week.taskPct != null ? `${week.taskPct}% complete` : 'No tasks',
          },
          {
            label: 'Plan & EOD',
            value: `${week.planDays}/${week.workingDays}`,
            sub:
              week.eodEligible > 0
                ? `EOD ${week.eodDays}/${week.eodEligible}`
                : 'No EOD eligible',
          },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-[11px] font-semibold text-gray-500">{c.label}</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{c.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Hours per day stacked */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-gray-700">Hours per day</p>
            <div className="flex flex-wrap gap-2 justify-end">
              {legendItems.map(l => (
                <span key={l.key} className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  <span className="truncate max-w-[100px]">{l.name}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stackData}
                margin={{ top: 4, right: CHART_PLOT_PAD.right, left: 0, bottom: 4 }}
                style={{ cursor: onDayBarClick ? 'pointer' : undefined }}
                onClick={(state) => {
                  if (!onDayBarClick) return
                  const row = state?.activePayload?.[0]?.payload as
                    | (typeof stackData)[number]
                    | undefined
                  const dateKey = row?.dateKey
                  if (dateKey) onDayBarClick(String(dateKey))
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={<ChartDayTick />}
                  interval={0}
                  height={28}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={CHART_PLOT_PAD.left}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const row = payload[0]?.payload as (typeof stackData)[0]
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-semibold text-gray-900">{label}</p>
                        {row.leaveLabel && <p className="text-violet-700 mt-0.5">{row.leaveLabel}</p>}
                        {payload.map(p => (
                          <p key={String(p.dataKey)} className="text-gray-600">
                            {legendItems.find(l => l.key === p.dataKey)?.name ?? p.dataKey}: {p.value}h
                          </p>
                        ))}
                        {row._empty && !row.leaveLabel && (
                          <p className="text-gray-400">{row.isWeekend ? 'Off' : 'No hours'}</p>
                        )}
                        {onDayBarClick && (
                          <p className="text-[10px] text-blue-600 mt-1">Click for day-by-day →</p>
                        )}
                      </div>
                    )
                  }}
                />
                {stackKeys.map((k, i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="h"
                    fill={
                      k === '__other__'
                        ? '#94a3b8'
                        : colorByKey.get(k) ?? PROJECT_BAR_COLORS[i % PROJECT_BAR_COLORS.length]
                    }
                    radius={i === stackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                    cursor={onDayBarClick ? 'pointer' : undefined}
                    background={
                      i === 0 && onDayBarClick
                        ? { fill: 'rgba(148, 163, 184, 0.08)', cursor: 'pointer' }
                        : undefined
                    }
                    onClick={(data) => {
                      if (!onDayBarClick) return
                      const dateKey =
                        (data as { dateKey?: string; payload?: { dateKey?: string } })?.dateKey ??
                        (data as { payload?: { dateKey?: string } })?.payload?.dateKey
                      if (dateKey) onDayBarClick(String(dateKey))
                    }}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Plan / EOD / leave — aligned to chart plot (under each bar) */}
          <div
            className="mt-1.5 grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${Math.max(stackData.length, 1)}, minmax(0, 1fr))`,
              paddingLeft: CHART_PLOT_PAD.left,
              paddingRight: CHART_PLOT_PAD.right,
            }}
          >
            {stackData.map(d => {
              const leaveText = d.leaveLabel
                ? String(d.leaveLabel).split(' · ')[0]
                : null
              const inner = leaveText ? (
                <span className="inline-flex max-w-full items-center justify-center rounded-full bg-slate-100 px-1.5 py-0.5 text-center text-[9px] font-semibold leading-tight text-violet-700 truncate">
                  {leaveText}
                </span>
              ) : d.isWeekend && d._empty ? (
                <span className="text-[9px] text-gray-400">Off</span>
              ) : (
                <span className="flex justify-center gap-0.5">
                  {d.missingPlan ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Missing plan" />
                  ) : null}
                  {d.missingEod ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Missing EOD" />
                  ) : null}
                </span>
              )
              const cellCls =
                'flex w-full min-h-[1.35rem] flex-col items-center justify-center gap-0.5'
              if (!onDayBarClick) {
                return (
                  <div key={String(d.dateKey)} className={cellCls}>
                    {inner}
                  </div>
                )
              }
              return (
                <button
                  key={String(d.dateKey)}
                  type="button"
                  onClick={() => onDayBarClick(String(d.dateKey))}
                  className={`${cellCls} rounded hover:bg-slate-50`}
                  title="View day-by-day"
                >
                  {inner}
                </button>
              )
            })}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Amber dots: missing plan / EOD
            {onDayBarClick ? ' · Click a bar (or day below) for day-by-day tasks' : ''}
          </p>
        </div>
      </div>

      {/* Projects this week mini table */}
      <div className="px-4 pb-4">
        <h5 className="text-xs font-semibold text-gray-700 mb-2">Projects this week</h5>
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-xs min-w-[640px]">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-wide">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Project</th>
                {weekdays.map(k => (
                  <th key={k} className="text-right font-semibold px-2 py-2">
                    {weekdayShort(k)}
                  </th>
                ))}
                <th className="text-right font-semibold px-3 py-2">Total</th>
                <th className="text-left font-semibold px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeProjects.length === 0 ? (
                <tr>
                  <td colSpan={weekdays.length + 3} className="px-3 py-4 text-center text-gray-400">
                    No project hours this week
                  </td>
                </tr>
              ) : (
                activeProjects.map(p => {
                  const pKey = p.projectId ?? '__none__'
                  const color = colorByKey.get(pKey) ?? '#94a3b8'
                  const name = !p.projectId || p.projectName === 'No project' ? 'No project' : p.projectName
                  const tag = worstProjectTag(p)
                  return (
                    <tr key={pKey} className="border-t border-gray-50">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
                          <span className="font-medium text-gray-900 truncate max-w-[140px]">{name}</span>
                        </span>
                      </td>
                      {weekdays.map(k => {
                        const h = Math.round(
                          p.tasks.filter(t => t.dateKey === k).reduce((s, t) => s + t.hours, 0) * 10,
                        ) / 10
                        return (
                          <td key={k} className="px-2 py-2 text-right tabular-nums text-gray-700">
                            {h > 0 ? h : '—'}
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">
                        {hrs(p.hoursLogged)}
                      </td>
                      <td className="px-3 py-2">
                        {tag ? (
                          <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              color: tag.tone === 'red' ? CEO.red : CEO.amber,
                              background: tag.tone === 'red' ? CEO.redBg : CEO.amberBg,
                            }}
                          >
                            {tag.label}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
