'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { startOfMonth, endOfMonth } from 'date-fns'
import { formatIstDate, formatIstLeaveRange, istDateInputValue } from '@/lib/ist'
import { SHORT_LEAVE_MONTHLY_CAP } from '@/lib/leave-math'
import SimpleSelect from '@/components/SimpleSelect'
import toast, { Toaster } from 'react-hot-toast'

type Employee = { id: string; name: string; email: string; role: string }

type UsagePayload = {
  member: Employee
  from: string
  to: string
  balance?: {
    year: number
    accrued: number
    used: number
    available: number
    shortLeaves: number
  }
  usage: {
    fullDayCount: number
    fullDayDays: number
    halfDayCount: number
    halfDayDays: number
    shortLeaveCount: number
    birthdayLeaveCount?: number
    compOffLeaveCount?: number
    workFromHomeCount?: number
    unpaidCount?: number
    totalDayBalance: number
    unpaidDayBalance?: number
    takenDays?: number
    totalRequests: number
    leaves: {
      id: string
      leaveType: string
      timeSlot: string | null
      startDate: string
      endDate: string
      reason: string | null
      status: string
      unpaid?: boolean
      paidDays?: number
      unpaidDays?: number
      days: number
    }[]
  }
}

function toInputDate(d: Date) {
  return istDateInputValue(d)
}

function formatLeaveType(type: string, slot?: string | null) {
  let base = type.replace(/_/g, ' ')
  if (slot) base += ` (${slot.replace(/_/g, ' ')})`
  return base
}

function formatDates(start: string, end: string) {
  return formatIstLeaveRange(start, end)
}

export default function LeaveUsageClient({ employees }: { employees: Employee[] }) {
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())

  const [memberId, setMemberId] = useState(employees[0]?.id || '')
  const [rangeMode, setRangeMode] = useState<'month' | 'custom'>('month')
  const [from, setFrom] = useState(toInputDate(monthStart))
  const [to, setTo] = useState(toInputDate(monthEnd))
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [data, setData] = useState<UsagePayload | null>(null)

  const selected = useMemo(
    () => employees.find(e => e.id === memberId) || null,
    [employees, memberId]
  )

  async function loadUsage(nextFrom = from, nextTo = to, nextMemberId = memberId) {
    if (!nextMemberId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        memberId: nextMemberId,
        from: nextFrom,
        to: nextTo,
      })
      const res = await fetch(`/api/leaves/usage?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load usage')
      setData(json)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function downloadReport() {
    if (!memberId) return
    setDownloading(true)
    try {
      const params = new URLSearchParams({
        memberId,
        from,
        to,
        format: 'csv',
      })
      const res = await fetch(`/api/leaves/usage?${params}`)
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Failed to download report')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `leave-usage-${from}-to-${to}.csv`

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    if (!memberId) return
    let nextFrom = from
    let nextTo = to
    if (rangeMode === 'month') {
      nextFrom = toInputDate(startOfMonth(new Date()))
      nextTo = toInputDate(endOfMonth(new Date()))
      setFrom(nextFrom)
      setTo(nextTo)
    }
    void loadUsage(nextFrom, nextTo, memberId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, rangeMode])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Toaster position="top-right" />

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs text-gray-400 mb-2">
            <Link href="/leaves" className="hover:text-gray-700">
              ← Leave Management
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Employee leave usage</h1>
          <p className="text-sm text-gray-500 mt-1">
            See how many full days, half days, and short leaves an employee has taken.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadReport}
          disabled={!memberId || downloading || loading}
          className="shrink-0 inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
        >
          {downloading ? 'Preparing…' : 'Download report'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Employee</label>
            <SimpleSelect
              aria-label="Employee"
              value={memberId}
              onChange={setMemberId}
              options={employees.map(e => ({
                value: e.id,
                label: `${e.name} · ${e.role}`,
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Period</label>
            <div className="flex bg-gray-100 p-1 rounded-xl ring-1 ring-gray-200">
              <button
                type="button"
                onClick={() => setRangeMode('month')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  rangeMode === 'month' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                This month
              </button>
              <button
                type="button"
                onClick={() => setRangeMode('custom')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  rangeMode === 'custom' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
                }`}
              >
                Custom dates
              </button>
            </div>
          </div>
        </div>

        {rangeMode === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">From</label>
              <input
                type="date"
                value={from}
                onChange={e => setFrom(e.target.value)}
                className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">To</label>
              <input
                type="date"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full text-sm rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-2.5"
              />
            </div>
            <button
              type="button"
              onClick={() => loadUsage()}
              disabled={loading}
              className="rounded-xl py-2.5 px-4 text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Apply range'}
            </button>
          </div>
        )}

        {selected && (
          <p className="text-xs text-gray-500">
            Showing approved leaves for <span className="font-semibold text-gray-700">{selected.name}</span>
            {' '}
            from {formatIstDate(from)} to {formatIstDate(to)}
          </p>
        )}
      </div>

      {loading && !data ? (
        <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 px-6 py-16 text-center text-sm text-gray-500">
          Loading usage…
        </div>
      ) : data ? (
        <>
          {data.balance && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                  Available ({data.balance.year})
                </p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{data.balance.available}</p>
              </div>
              <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                  Total ({data.balance.year})
                </p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{data.balance.accrued}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">1 day / month</p>
              </div>
              <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                  Used ({data.balance.year})
                </p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{data.balance.used}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">paid days</p>
              </div>
              <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 truncate">
                  Short leaves
                </p>
                <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{data.balance.shortLeaves}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate" title="Not deducted from Total (max 2 per month)">
                  max 2 / month
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <div className="rounded-xl bg-slate-900 text-white px-3 py-2.5 shadow-sm min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300 truncate">Days taken</p>
              <p className="text-xl font-bold mt-0.5 tabular-nums">
                {data.usage.takenDays ?? data.usage.fullDayDays + data.usage.halfDayDays}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                {data.usage.totalDayBalance} paid
                {(data.usage.unpaidDayBalance ?? 0) > 0 ? ` · ${data.usage.unpaidDayBalance} unpaid` : ''}
              </p>
            </div>
            <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 truncate">Full day</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{data.usage.fullDayCount}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{data.usage.fullDayDays} day(s)</p>
            </div>
            <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 truncate">Half day</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">{data.usage.halfDayCount}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{data.usage.halfDayDays} day(s)</p>
            </div>
            <div className="rounded-xl bg-white ring-1 ring-gray-900/5 px-3 py-2.5 shadow-sm min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 truncate">Short leave</p>
              <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">
                {data.usage.shortLeaveCount}/{SHORT_LEAVE_MONTHLY_CAP}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">used / cap</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
            <div className="px-4 py-3 sm:px-5 border-b border-gray-100 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900">Approved leaves in range</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.usage.totalRequests} request{data.usage.totalRequests === 1 ? '' : 's'}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadReport}
                disabled={downloading}
                className="btn-secondary inline-flex items-center justify-center text-xs !px-3 !py-1.5 whitespace-nowrap self-start sm:self-auto disabled:opacity-50"
              >
                {downloading ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>

            {data.usage.leaves.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm text-gray-500">
                No approved leaves in this period.
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {data.usage.leaves.map(l => (
                  <div
                    key={l.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-900 capitalize">
                          {formatLeaveType(l.leaveType, l.timeSlot)}
                        </div>
                        {l.unpaid && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ring-1 ring-inset bg-orange-50 text-orange-800 ring-orange-600/20">
                            {Number(l.paidDays || 0) > 0 && Number(l.unpaidDays || 0) > 0
                              ? `${l.paidDays} paid + ${l.unpaidDays} unpaid`
                              : 'Unpaid'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatDates(l.startDate, l.endDate)}
                      </div>
                      {l.reason && (
                        <div className="text-xs text-gray-400 mt-1 line-clamp-1">{l.reason}</div>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-gray-600 shrink-0">
                      {l.leaveType === 'short_leave' ||
                      l.leaveType === 'birthday_leave' ||
                      l.leaveType === 'comp_off_leave' ||
                      l.leaveType === 'work_from_home'
                        ? 'Not counted in day balance'
                        : l.unpaid
                          ? Number(l.paidDays || 0) > 0
                            ? `${l.days} days · ${l.paidDays} paid + ${l.unpaidDays} unpaid`
                            : `${l.days} day${l.days === 1 ? '' : 's'} · unpaid`
                          : `${l.days} day${l.days === 1 ? '' : 's'}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-white ring-1 ring-gray-900/5 px-6 py-16 text-center text-sm text-gray-500">
          Select an employee to view leave usage.
        </div>
      )}
    </div>
  )
}
