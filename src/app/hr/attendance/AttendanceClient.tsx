'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { KpiCard, type Kpi } from '@/components/KpiCard'
import EmptyState from '@/components/EmptyState'
import {
  applyRunningBalance,
  attendanceRowBgClass,
  computeDayStatus,
  timeToSeconds,
} from '@/lib/attendance/math'
import type { AttendanceDayRow, AttendanceSheet } from '@/lib/attendance/types'
import { exportAttendanceExcel, saveAttendanceAdjustmentsBatch } from './actions'

type Draft = { grossHours: string; leaveHours: string; ebh: string }

function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function datePresets(todayKey: string, maxToKey: string) {
  const [y, m, d] = todayKey.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  const weekStart = shiftKey(todayKey, -mondayOffset)
  return [
    { key: 'yesterday', label: 'Yesterday', from: maxToKey, to: maxToKey },
    {
      key: 'week',
      label: 'This week',
      from: weekStart > maxToKey ? maxToKey : weekStart,
      to: maxToKey,
    },
    { key: '7d', label: 'Last 7 days', from: shiftKey(maxToKey, -6), to: maxToKey },
    {
      key: 'month',
      label: 'This month',
      from: `${maxToKey.slice(0, 8)}01`,
      to: maxToKey,
    },
  ]
}

function hrefFor(from: string, to: string) {
  return `/hr/attendance?from=${from}&to=${to}`
}

function formatDayHeader(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function groupByDate(
  rows: AttendanceDayRow[],
  holidays: Array<{ date: string; name: string }> = [],
) {
  const map = new Map<string, AttendanceDayRow[]>()
  for (const r of rows) {
    if (!map.has(r.date)) map.set(r.date, [])
    map.get(r.date)!.push(r)
  }
  const holidayByDate = new Map(holidays.map(h => [h.date, h.name]))
  for (const h of holidays) {
    if (!map.has(h.date)) map.set(h.date, [])
  }
  for (const r of rows) {
    if (r.isHoliday && r.holidayName) holidayByDate.set(r.date, r.holidayName)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      holidayName: holidayByDate.get(date) ?? null,
      records: list.sort((a, b) => a.empNo - b.empNo || a.name.localeCompare(b.name)),
    }))
}

function statusLabel(row: AttendanceDayRow) {
  if (row.status === 'Absent') return row.leaveLabel || 'Absent (no leave)'
  if (row.status === 'Leave') return row.leaveLabel || 'Leave'
  if (row.leaveLabel) {
    return row.status === 'Short' || row.status === 'OK'
      ? `${row.leaveLabel}${row.status === 'Short' ? ' · Short' : ''}`
      : row.leaveLabel
  }
  return row.status
}

function rowKey(row: Pick<AttendanceDayRow, 'memberId' | 'date'>) {
  return `${row.memberId}-${row.date}`
}

function normTime(v: string | null | undefined) {
  return (v || '').trim()
}

function baselineDraft(row: AttendanceDayRow): Draft {
  return {
    grossHours: normTime(row.grossTwh),
    leaveHours: normTime(row.leaveHours),
    ebh: normTime(row.ebh),
  }
}

function isDirtyDraft(row: AttendanceDayRow, draft: Draft): boolean {
  const base = baselineDraft(row)
  return (
    normTime(draft.grossHours) !== base.grossHours ||
    normTime(draft.leaveHours) !== base.leaveHours ||
    normTime(draft.ebh) !== base.ebh
  )
}

function HeaderTip({ label, tip }: { label: string; tip: string }) {
  return (
    <th className="px-3 py-2 font-medium text-center" title={tip}>
      <span className="border-b border-dotted border-gray-400 cursor-help">{label}</span>
    </th>
  )
}

function LeaveColorLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-red-500 ring-1 ring-red-600" />
        Full day
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-red-100 ring-1 ring-red-200" />
        Half day
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-sky-200 ring-1 ring-sky-300" />
        Short leave
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-teal-100 ring-1 ring-teal-200" />
        WFH
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-yellow-100 ring-1 ring-yellow-300" />
        Hours short
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-orange-100 ring-1 ring-orange-300" />
        Absent
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-indigo-50 ring-1 ring-indigo-300" />
        Unsaved edit
      </span>
    </div>
  )
}

export default function AttendanceClient({
  from,
  to,
  todayKey,
  maxToKey,
  canEdit,
  role,
  sheet,
}: {
  from: string
  to: string
  todayKey: string
  maxToKey: string
  canEdit: boolean
  role: string
  sheet: AttendanceSheet
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  useEffect(() => {
    setDrafts(prev => {
      const next: Record<string, Draft> = {}
      let changed = false
      for (const [key, draft] of Object.entries(prev)) {
        const row = sheet.rows.find(r => rowKey(r) === key)
        if (!row) {
          changed = true
          continue
        }
        if (isDirtyDraft(row, draft)) next[key] = draft
        else changed = true
      }
      return changed ? next : prev
    })
  }, [sheet.rows])

  const dirtyKeys = useMemo(() => {
    const keys: string[] = []
    for (const [key, draft] of Object.entries(drafts)) {
      const row = sheet.rows.find(r => rowKey(r) === key)
      if (row && isDirtyDraft(row, draft)) keys.push(key)
    }
    return keys
  }, [drafts, sheet.rows])

  const dirtyCount = dirtyKeys.length
  const hasDirty = dirtyCount > 0

  useEffect(() => {
    if (!hasDirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasDirty])

  const confirmLeaveIfDirty = useCallback(() => {
    if (!hasDirty) return true
    return window.confirm('You have unsaved attendance changes. Discard them and continue?')
  }, [hasDirty])

  const displayRows = useMemo(() => {
    const patched = sheet.rows.map(row => {
      const draft = drafts[rowKey(row)]
      if (!draft || !isDirtyDraft(row, draft)) return row
      if (row.isHoliday) return row
      const leaveOrAbsent = row.status === 'Leave' || row.status === 'Absent'
      if (leaveOrAbsent) return row

      const grossTwh = normTime(draft.grossHours) || '0:00'
      const leaveHours = normTime(draft.leaveHours) || '0:00'
      const ebh = normTime(draft.ebh) || '0:00'
      const { status, swh } = computeDayStatus({
        grossTwh,
        leaveHours,
        leaveType: row.leaveType,
        hasActivity:
          Boolean(row.start) ||
          row.fixedHours ||
          timeToSeconds(grossTwh) > 0 ||
          timeToSeconds(row.twh) > 0,
        fixedHours: row.fixedHours,
      })

      return {
        ...row,
        grossTwh,
        leaveHours,
        ebh,
        status,
        swh,
        psw: '0:00',
        tswh: '0:00',
      }
    })
    return applyRunningBalance(patched)
  }, [sheet.rows, drafts])

  const grouped = useMemo(
    () => groupByDate(displayRows, sheet.holidays ?? []),
    [displayRows, sheet.holidays],
  )

  const presets = datePresets(todayKey, maxToKey)
  const activePreset = presets.find(p => p.from === from && p.to === to)?.key

  const presentKpi: Kpi = {
    label: 'Present (last working day)',
    value: String(sheet.kpis.presentToday),
    sub: 'People who worked or were short that day',
    tone: sheet.kpis.presentToday ? 'normal' : 'muted',
    tint: 'emerald',
    icon: 'ontime',
  }
  const shortageKpi: Kpi = {
    label: 'Total hours short',
    value: sheet.kpis.totalShortageHours,
    sub:
      sheet.kpis.shortagePeople > 0
        ? `across ${sheet.kpis.shortagePeople} people this period`
        : 'No shortage this period',
    tone: sheet.kpis.totalShortageHours !== '0:00' ? 'amber' : 'muted',
    tint: 'sky',
    icon: 'calendar',
  }

  function formatLeaveDays(days: number): string {
    if (Number.isInteger(days)) return String(days)
    return days.toFixed(1).replace(/\.0$/, '')
  }

  function originalRow(row: AttendanceDayRow): AttendanceDayRow {
    return sheet.rows.find(r => rowKey(r) === rowKey(row)) ?? row
  }

  function getDraft(row: AttendanceDayRow): Draft {
    const base = originalRow(row)
    return drafts[rowKey(row)] ?? baselineDraft(base)
  }

  function setDraftField(row: AttendanceDayRow, field: keyof Draft, value: string) {
    const key = rowKey(row)
    const base = originalRow(row)
    setDrafts(prev => {
      const current = prev[key] ?? baselineDraft(base)
      const nextDraft = { ...current, [field]: value }
      if (!isDirtyDraft(base, nextDraft)) {
        if (!(key in prev)) return prev
        const { [key]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [key]: nextDraft }
    })
  }

  function onDiscard() {
    setDrafts({})
  }


  async function onSaveAll() {
    if (!canEdit || dirtyCount === 0) return
    setSaving(true)
    try {
      const payload = dirtyKeys
        .map(key => {
          const row = sheet.rows.find(r => rowKey(r) === key)
          const draft = drafts[key]
          if (!row || !draft) return null
          return {
            memberId: row.memberId,
            date: row.date,
            grossHours: draft.grossHours,
            leaveHours: draft.leaveHours,
            ebh: draft.ebh,
          }
        })
        .filter(Boolean) as Array<{
        memberId: string
        date: string
        grossHours: string
        leaveHours: string
        ebh: string
      }>

      const result = await saveAttendanceAdjustmentsBatch(payload)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.saved === 1 ? 'Saved 1 attendance change' : `Saved ${result.saved} attendance changes`,
      )
      setDrafts({})
      startTransition(() => router.refresh())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function onExport() {
    setExporting(true)
    try {
      const result = await exportAttendanceExcel(from, to)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const bin = atob(result.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={`space-y-5 ${canEdit && hasDirty ? 'pb-24' : ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">HR · People</p>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight">Attendance</h1>
          <p className="text-sm text-gray-500 mt-1">
            ScreenshotMonitor hours · 9h target ·{' '}
            {canEdit ? 'HR can edit Gross / Leave / EBH' : 'Founder view + export'}
            {role === 'Founder' && !canEdit ? ' (read-only)' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap lg:shrink-0">
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto" aria-label="Quick ranges">
            {presets.map(p => {
              const on = activePreset === p.key
              return (
                <Link
                  key={p.key}
                  href={hrefFor(p.from, p.to)}
                  scroll={false}
                  aria-current={on ? 'true' : undefined}
                  onClick={e => {
                    if (!confirmLeaveIfDirty()) e.preventDefault()
                    else if (hasDirty) setDrafts({})
                  }}
                  className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset transition-colors whitespace-nowrap ${
                    on
                      ? 'bg-gray-900 text-white ring-gray-900'
                      : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </Link>
              )
            })}
          </div>
          <span className="hidden lg:block h-6 w-px shrink-0 bg-gray-200" aria-hidden="true" />
          <form
            className="flex flex-nowrap items-center gap-2"
            onSubmit={e => {
              if (!confirmLeaveIfDirty()) {
                e.preventDefault()
                return
              }
              if (hasDirty) setDrafts({})
            }}
          >
            <label htmlFor="from" className="sr-only">
              From
            </label>
            <input
              type="date"
              id="from"
              name="from"
              defaultValue={from}
              max={maxToKey}
              className="h-9 w-36 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <span className="text-xs text-gray-400" aria-hidden="true">
              –
            </span>
            <label htmlFor="to" className="sr-only">
              To
            </label>
            <input
              type="date"
              id="to"
              name="to"
              defaultValue={to}
              max={maxToKey}
              className="h-9 w-36 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center rounded-lg bg-gray-900 px-3.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
            >
              View
            </button>
          </form>
          <button
            type="button"
            onClick={onExport}
            disabled={exporting || sheet.tokenMissing || !!sheet.fetchError || sheet.rows.length === 0}
            title="Exports everyone in the selected date range"
            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        </div>
      </div>

      {!sheet.schemaReady ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Database migration not applied yet — sheet still loads with name fallbacks. Saving edits will fail until you
          run <code className="text-xs bg-amber-100 px-1 rounded">npx prisma db push</code>.
        </div>
      ) : null}

      {sheet.tokenMissing ? (
        <div className="card">
          <EmptyState
            icon="inbox"
            title="ScreenshotMonitor token missing"
            hint={
              <>
                Add <code className="text-[11px] bg-gray-100 px-1 rounded">SM_API_TOKEN</code> to the server env, then
                refresh.
              </>
            }
          />
        </div>
      ) : sheet.fetchError ? (
        <div className="card">
          <EmptyState icon="inbox" title="Could not load ScreenshotMonitor data" hint={sheet.fetchError} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <KpiCard k={presentKpi} />
            <div className="card p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset bg-teal-50 text-teal-600 ring-teal-100">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-[18px] w-[18px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3.5" y="5" width="17" height="15" rx="2" />
                    <path d="M8 3v4M16 3v4M3.5 10h17" />
                    <path d="M9 15l2 2 4-4" />
                  </svg>
                </span>
                <span className="text-xs font-medium text-gray-500 leading-tight">Leave this period</span>
              </div>
              <div className="grid grid-cols-2 gap-3 divide-x divide-gray-100">
                <div className="min-w-0 pr-3">
                  <div className="text-[11px] font-medium text-gray-500">Approved</div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                    <span
                      className={`text-2xl font-semibold tabular-nums leading-tight ${
                        sheet.kpis.leaveApprovedDays > 0 || sheet.kpis.leaveShortDays > 0
                          ? 'text-red-600'
                          : 'text-gray-400'
                      }`}
                    >
                      {formatLeaveDays(sheet.kpis.leaveApprovedDays)}
                    </span>
                    {sheet.kpis.leaveShortDays > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-100">
                        +{sheet.kpis.leaveShortDays} short
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {sheet.kpis.leaveApprovedPeople} people
                  </div>
                </div>
                <div className="min-w-0 pl-3">
                  <div className="text-[11px] font-medium text-gray-500">Without approval</div>
                  <div
                    className={`mt-0.5 text-2xl font-semibold tabular-nums leading-tight ${
                      sheet.kpis.absentWithoutLeave > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}
                  >
                    {sheet.kpis.absentWithoutLeave}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{sheet.kpis.absentPeople} people</div>
                </div>
              </div>
            </div>
            <KpiCard k={shortageKpi} />
          </div>

          {grouped.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="calendar"
                title="No attendance rows"
                hint="Pick another range, or check that active team members are mapped to ScreenshotMonitor."
              />
            </div>
          ) : (
            <div id="attendance-table" className="space-y-6 scroll-mt-20">
              <LeaveColorLegend />
              {grouped.map(group => (
                <section key={group.date} className="card overflow-hidden">
                  {group.holidayName ? (
                    <div className="px-4 sm:px-5 py-3 border-b border-emerald-100 bg-emerald-50/90">
                      <h2 className="text-sm font-semibold text-emerald-900">
                        {formatDayHeader(group.date)} · {group.holidayName} · Holiday
                      </h2>
                      <p className="text-xs text-emerald-700/80 mt-0.5">
                        {group.records.length === 0
                          ? 'No attendance expected — shortage balance unchanged'
                          : `${group.records.length} worked (hours shown, no shortage counted)`}
                      </p>
                    </div>
                  ) : (
                    <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/80">
                      <h2 className="text-sm font-semibold text-gray-900">{formatDayHeader(group.date)}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{group.records.length} people</p>
                    </div>
                  )}
                  {group.holidayName && group.records.length === 0 ? null : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-500">
                            <th className="px-3 py-2 font-medium">Emp</th>
                            <th className="px-3 py-2 font-medium">Name</th>
                            <th className="px-3 py-2 font-medium text-center">C-In</th>
                            <th className="px-3 py-2 font-medium text-center">C-Out</th>
                            <th className="px-3 py-2 font-medium text-center" title="Gross shift length (clock-out − clock-in)">
                              Gross
                            </th>
                            <HeaderTip
                              label="TWH"
                              tip="Tracked work hours from ScreenshotMonitor (sum of active time)"
                            />
                            <th className="px-3 py-2 font-medium text-center">Leave Hrs</th>
                            <HeaderTip label="SWH" tip="Shortfall that day versus the 9h target" />
                            <th className="px-3 py-2 font-medium text-center">Status</th>
                            <HeaderTip label="EBH" tip="Extra break hours (manual adjustment)" />
                            <HeaderTip label="PSW" tip="Previous shortfall carried in from earlier days" />
                            <HeaderTip label="TSWH" tip="Total shortfall so far in this period" />
                          </tr>
                        </thead>
                        <tbody>
                          {group.records.map(row => {
                            const leaveOrAbsent = row.status === 'Leave' || row.status === 'Absent'
                            const dirty = dirtyKeys.includes(rowKey(row))
                            const rowBg = dirty
                              ? 'bg-indigo-50/80 ring-1 ring-inset ring-indigo-200'
                              : attendanceRowBgClass(row)
                            const draft = getDraft(row)
                            const inputClass = dirty
                              ? 'w-16 rounded border border-indigo-300 bg-white px-1.5 py-1 text-center tabular-nums ring-1 ring-indigo-200'
                              : 'w-16 rounded border border-gray-200 bg-white px-1.5 py-1 text-center tabular-nums'

                            return (
                              <tr key={`${row.memberId}-${row.date}`} className={`border-b border-gray-50 ${rowBg}`}>
                                <td className="px-3 py-2 tabular-nums text-gray-600">{row.empNo || '—'}</td>
                                <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                                  {row.name}
                                  {row.fixedHours ? (
                                    <span className="ml-1 text-[10px] font-normal text-gray-400">fixed</span>
                                  ) : null}
                                  {row.hasAdjustment && !dirty ? (
                                    <span className="ml-1 text-[10px] font-normal text-indigo-500">edited</span>
                                  ) : null}
                                  {dirty ? (
                                    <span className="ml-1 text-[10px] font-normal text-indigo-600">unsaved</span>
                                  ) : null}
                                </td>
                                {leaveOrAbsent ? (
                                  <td colSpan={10} className="px-3 py-2 text-center font-semibold text-gray-900">
                                    {statusLabel(row)}
                                  </td>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 text-center tabular-nums">{row.start || '—'}</td>
                                    <td className="px-3 py-2 text-center tabular-nums">{row.end || '—'}</td>
                                    <td className="px-3 py-2 text-center">
                                      {canEdit ? (
                                        <input
                                          className={inputClass}
                                          value={draft.grossHours}
                                          onChange={e => setDraftField(row, 'grossHours', e.target.value)}
                                          placeholder="0:00"
                                        />
                                      ) : (
                                        <span className="tabular-nums">{row.grossTwh}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">{row.twh}</td>
                                    <td className="px-3 py-2 text-center">
                                      {canEdit ? (
                                        <input
                                          className={inputClass}
                                          value={draft.leaveHours}
                                          onChange={e => setDraftField(row, 'leaveHours', e.target.value)}
                                          placeholder="0:00"
                                        />
                                      ) : (
                                        <span className="tabular-nums">{row.leaveHours}</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">{row.swh}</td>
                                    <td className="px-3 py-2 text-center font-medium">{statusLabel(row)}</td>
                                    <td className="px-3 py-2 text-center">
                                      {canEdit ? (
                                        <input
                                          className={inputClass}
                                          value={draft.ebh}
                                          onChange={e => setDraftField(row, 'ebh', e.target.value)}
                                          placeholder="0:00"
                                        />
                                      ) : (
                                        <span className="tabular-nums">{row.ebh}</span>
                                      )}
                                    </td>
                                    <td
                                      className={`px-3 py-2 text-center tabular-nums ${
                                        row.psw && row.psw !== '0:00' ? 'text-red-600' : ''
                                      }`}
                                    >
                                      {row.psw}
                                    </td>
                                    <td
                                      className={`px-3 py-2 text-center tabular-nums ${
                                        row.tswh && row.tswh !== '0:00' ? 'text-red-600' : ''
                                      }`}
                                    >
                                      {row.tswh}
                                    </td>
                                  </>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {canEdit && hasDirty ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg shadow-gray-900/10 ring-1 ring-black/5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {dirtyCount} unsaved change{dirtyCount === 1 ? '' : 's'}
              </p>
              <p className="text-[11px] text-gray-500">
                {pending ? 'Refreshing sheet…' : 'Daily shortfall updates as you type'}
              </p>
            </div>
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onSaveAll}
              disabled={saving || pending}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-gray-900 px-3.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden="true"
                  />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
