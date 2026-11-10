'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  HOLIDAY_TYPES,
  HOLIDAY_TYPE_LABELS,
  isNonWorkingHolidayType,
  type HolidayEntry,
  type HolidayType,
} from '@/lib/holidays-shared'

const TYPE_BADGE: Record<HolidayType, string> = {
  national: 'bg-orange-100 text-orange-800',
  public: 'bg-indigo-100 text-indigo-800',
  floating: 'bg-teal-100 text-teal-800',
  sunday: 'bg-gray-100 text-gray-600',
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${dateKey}T00:00:00Z`))
}

function weekday(dateKey: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(`${dateKey}T00:00:00Z`),
  )
}

function daysUntil(todayKey: string, dateKey: string) {
  return Math.round(
    (new Date(`${dateKey}T00:00:00Z`).getTime() - new Date(`${todayKey}T00:00:00Z`).getTime()) / 86_400_000,
  )
}

type Draft = { date: string; name: string; type: HolidayType }

export default function HolidaysClient({
  initialHolidays,
  todayKey,
  initialYear,
  canManage,
  usingFallback,
}: {
  initialHolidays: HolidayEntry[]
  todayKey: string
  initialYear: number
  canManage: boolean
  usingFallback: boolean
}) {
  const currentYear = Number(todayKey.slice(0, 4))
  const [holidays, setHolidays] = useState<HolidayEntry[]>(initialHolidays)
  const [year, setYear] = useState(initialYear)
  const [extraYears, setExtraYears] = useState<number[]>([])
  const [draft, setDraft] = useState<Draft>({ date: '', name: '', type: 'public' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newYearInput, setNewYearInput] = useState('')

  // Tabs: every year that has holidays + current + next year (+ any year HR opened), sorted.
  const years = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear + 1, year, ...extraYears])
    for (const h of holidays) set.add(Number(h.date.slice(0, 4)))
    return [...set].sort((a, b) => a - b)
  }, [holidays, currentYear, year, extraYears])

  const yearHolidays = useMemo(
    () => holidays.filter(h => h.date.startsWith(`${year}-`)).sort((a, b) => a.date.localeCompare(b.date)),
    [holidays, year],
  )
  const nextUpcoming = holidays
    .filter(h => h.date >= todayKey && h.type !== 'sunday')
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  function selectYear(y: number) {
    setYear(y)
    setEditingId(null)
    setError(null)
    setDraft(d => ({ ...d, date: d.date.startsWith(`${y}-`) ? d.date : '' }))
  }

  function openYear() {
    const y = Number(newYearInput)
    if (!/^\d{4}$/.test(newYearInput) || y < 2020 || y > 2100) {
      setError('Enter a year between 2020 and 2100.')
      return
    }
    setExtraYears(list => (list.includes(y) ? list : [...list, y]))
    setNewYearInput('')
    selectYear(y)
  }

  async function addHoliday(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/leaves/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not add the holiday.')
      setHolidays(list => [...list, data.holiday as HolidayEntry])
      const addedYear = Number((data.holiday as HolidayEntry).date.slice(0, 4))
      if (addedYear !== year) setYear(addedYear)
      setDraft({ date: '', name: '', type: draft.type })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the holiday.')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: string) {
    if (!editDraft) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaves/holidays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update the holiday.')
      setHolidays(list => list.map(h => (h.id === id ? (data.holiday as HolidayEntry) : h)))
      setEditingId(null)
      setEditDraft(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the holiday.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(h: HolidayEntry) {
    if (!window.confirm(`Delete ${h.name} (${formatDate(h.date)} ${h.date.slice(0, 4)})?`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaves/holidays/${h.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not delete the holiday.')
      setHolidays(list => list.filter(x => x.id !== h.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the holiday.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Holiday calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            KeyMouse IT holidays. No plan, EOD or reminders on national and public holidays. Floating holidays are
            optional — apply for leave if you take one.
          </p>
        </div>
        <Link href="/leaves" className="btn-secondary text-xs shrink-0 self-start md:self-auto">
          ← Leaves
        </Link>
      </div>

      {usingFallback && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Showing the built-in 2026 calendar — the holiday table isn&apos;t available yet
          {canManage ? ', so changes can’t be saved until the database update is run.' : '.'}
        </div>
      )}

      {nextUpcoming && (
        <div className="mb-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <span aria-hidden className="mr-1.5">🎉</span>
          {nextUpcoming.date === todayKey ? (
            <>
              <span className="font-semibold">Today:</span> {nextUpcoming.name}
            </>
          ) : (
            <>
              <span className="font-semibold">Next holiday:</span> {nextUpcoming.name} ·{' '}
              {weekday(nextUpcoming.date)} {formatDate(nextUpcoming.date)} {nextUpcoming.date.slice(0, 4)} (in{' '}
              {daysUntil(todayKey, nextUpcoming.date)} day{daysUntil(todayKey, nextUpcoming.date) === 1 ? '' : 's'})
            </>
          )}
          <span className="text-indigo-600/80 text-xs"> · {HOLIDAY_TYPE_LABELS[nextUpcoming.type]}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap bg-gray-100/80 p-1 rounded-xl ring-1 ring-gray-200/50">
          {years.map(y => (
            <button
              key={y}
              type="button"
              onClick={() => selectYear(y)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                y === year
                  ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <input
              className="input !w-24"
              inputMode="numeric"
              placeholder="Year"
              value={newYearInput}
              onChange={e => setNewYearInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  openYear()
                }
              }}
              aria-label="Open another year"
            />
            <button type="button" className="btn-secondary text-xs" onClick={openYear}>
              Open year
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {canManage && (
        <form onSubmit={addHoliday} className="card p-4 mb-4 grid gap-3 sm:grid-cols-[160px_1fr_180px_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="holiday-date">Date</label>
            <input
              id="holiday-date"
              type="date"
              className="input"
              required
              min={`${year}-01-01`}
              max={`${year}-12-31`}
              value={draft.date}
              onChange={e => setDraft(d => ({ ...d, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="holiday-name">Holiday name</label>
            <input
              id="holiday-name"
              className="input"
              required
              maxLength={100}
              placeholder="e.g. Holi"
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="holiday-type">Type</label>
            <select
              id="holiday-type"
              className="input"
              value={draft.type}
              onChange={e => setDraft(d => ({ ...d, type: e.target.value as HolidayType }))}
            >
              {HOLIDAY_TYPES.map(t => (
                <option key={t} value={t}>
                  {HOLIDAY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={busy || usingFallback}>
            Add to {year}
          </button>
        </form>
      )}

      <div className="card overflow-hidden">
        {yearHolidays.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            No holidays added for {year} yet.{canManage ? ' Add them above.' : ''}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Day</th>
                <th className="px-4 py-2.5 font-medium">Holiday</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                {canManage && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {yearHolidays.map(h => {
                const past = h.date < todayKey
                const isToday = h.date === todayKey
                const soon = !past && daysUntil(todayKey, h.date) <= 7
                const editing = editingId === h.id && editDraft
                return (
                  <tr
                    key={h.id}
                    className={
                      isToday || soon
                        ? 'bg-indigo-50/60'
                        : past
                          ? 'text-gray-400'
                          : ''
                    }
                  >
                    {editing ? (
                      <>
                        <td className="px-4 py-2" colSpan={2}>
                          <input
                            type="date"
                            className="input"
                            value={editDraft.date}
                            onChange={e => setEditDraft(d => (d ? { ...d, date: e.target.value } : d))}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="input"
                            maxLength={100}
                            value={editDraft.name}
                            onChange={e => setEditDraft(d => (d ? { ...d, name: e.target.value } : d))}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            className="input"
                            value={editDraft.type}
                            onChange={e => setEditDraft(d => (d ? { ...d, type: e.target.value as HolidayType } : d))}
                          >
                            {HOLIDAY_TYPES.map(t => (
                              <option key={t} value={t}>
                                {HOLIDAY_TYPE_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            className="btn-primary text-xs !px-3 !py-1.5"
                            disabled={busy}
                            onClick={() => saveEdit(h.id)}
                          >
                            Save
                          </button>{' '}
                          <button
                            type="button"
                            className="btn-secondary text-xs !px-3 !py-1.5"
                            onClick={() => {
                              setEditingId(null)
                              setEditDraft(null)
                            }}
                          >
                            Cancel
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 tabular-nums font-medium whitespace-nowrap">
                          {formatDate(h.date)}
                        </td>
                        <td className="px-4 py-3">{weekday(h.date)}</td>
                        <td className="px-4 py-3">
                          <span className={past ? '' : 'text-gray-900 font-medium'}>{h.name}</span>
                          {isToday && <span className="badge bg-indigo-600 text-white ml-2">Today</span>}
                          {!isToday && soon && (
                            <span className="badge bg-indigo-100 text-indigo-800 ml-2">
                              In {daysUntil(todayKey, h.date)} day{daysUntil(todayKey, h.date) === 1 ? '' : 's'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge ${TYPE_BADGE[h.type]}`}>{HOLIDAY_TYPE_LABELS[h.type]}</span>
                          {!isNonWorkingHolidayType(h.type) && (
                            <span className="ml-1.5 text-xs text-gray-400">optional</span>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs font-medium text-gray-600 hover:text-gray-900"
                              disabled={busy || usingFallback}
                              onClick={() => {
                                setEditingId(h.id)
                                setEditDraft({ date: h.date, name: h.name, type: h.type })
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="ml-3 text-xs font-medium text-red-600 hover:text-red-800"
                              disabled={busy || usingFallback}
                              onClick={() => remove(h)}
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400">
        National and public holidays: no Slack or in-app reminders and no plan expected. Floating holidays: reminders
        still run; anyone on approved leave is left out.
      </p>
    </div>
  )
}
