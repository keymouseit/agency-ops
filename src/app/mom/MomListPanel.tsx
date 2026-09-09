'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fmtDate, MOM_FINAL_STATUSES, MOM_MEETING_TYPE_COLORS } from '@/lib/utils'
import {
  filterMomsByQuery,
  type MomSearchable,
} from '@/lib/mom'

type MomRecord = MomSearchable & {
  meetingDate: string | Date
  followUpDate: string | Date | null
  followUpCompletedAt?: string | Date | null
  followUpCount?: number
  finalStatus?: string | null
  meetingTime?: string | null
}

type NormalizedMom = ReturnType<typeof normalizeRecord>

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function normalizeRecord(record: MomRecord) {
  return {
    ...record,
    meetingDate: toDate(record.meetingDate)!,
    followUpDate: toDate(record.followUpDate),
    followUpCompletedAt: toDate(record.followUpCompletedAt),
    finalStatus: record.finalStatus || 'Active',
  }
}

function MomListRow({ record }: { record: NormalizedMom }) {
  const title = record.companyName
    ? `${record.clientName} · ${record.companyName}`
    : record.clientName

  return (
    <Link
      href={`/mom/${record.id}`}
      className="grid grid-cols-1 sm:grid-cols-[minmax(140px,18%)_minmax(0,1fr)_minmax(200px,28%)] gap-2 sm:gap-6 px-6 py-5 hover:bg-[#f7f7f7] transition-colors items-center"
    >
      <div className="text-sm text-[#5e6d55]">
        <div>{fmtDate(record.meetingDate)}</div>
        <div className="mt-0.5">
          {formatDistanceToNow(record.meetingDate, { addSuffix: true })}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[15px] text-[#1f57c3] underline leading-snug">
          {title}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <span className={`badge ${MOM_MEETING_TYPE_COLORS[record.meetingType] ?? 'bg-gray-100 text-gray-700'}`}>
          {record.meetingType}
        </span>
        {record.leadSource ? (
          <span className="badge bg-sky-50 text-sky-800">{record.leadSource}</span>
        ) : null}
        <span className="badge bg-gray-100 text-gray-700">
          {record.createdBy.name}
        </span>
      </div>
    </Link>
  )
}

function StatusCard({
  title,
  records,
}: {
  title: string
  records: NormalizedMom[]
}) {
  return (
    <section className="rounded-2xl border border-[#e0e0e0] bg-white overflow-hidden">
      <div className="px-6 py-5">
        <h2 className="text-xl font-semibold text-[#001e00]">
          {title} ({records.length})
        </h2>
      </div>
      {records.length > 0 ? (
        <div className="divide-y divide-[#e0e0e0] border-t border-[#e0e0e0]">
          {records.map(record => (
            <MomListRow key={record.id} record={record} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default function MomListPanel({ records }: { records: MomRecord[] }) {
  const [query, setQuery] = useState('')

  const normalized = useMemo(
    () => records.map(normalizeRecord),
    [records],
  )

  const searched = useMemo(
    () => filterMomsByQuery(normalized, query),
    [normalized, query],
  )

  const grouped = useMemo(() => {
    const next: Record<(typeof MOM_FINAL_STATUSES)[number], NormalizedMom[]> = {
      Active: [],
      Hold: [],
      Closed: [],
    }
    for (const record of searched) {
      const status = MOM_FINAL_STATUSES.includes(record.finalStatus as (typeof MOM_FINAL_STATUSES)[number])
        ? (record.finalStatus as (typeof MOM_FINAL_STATUSES)[number])
        : 'Active'
      next[status].push(record)
    }
    return next
  }, [searched])

  const trimmedQuery = query.trim()

  return (
    <div>
      <div className="relative w-full sm:max-w-md mb-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400" aria-hidden>
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
        </div>
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by client name, company, email…"
          className={`input !pl-10 py-2 text-sm bg-white${trimmedQuery ? ' !pr-16' : ''}`}
          aria-label="Search meeting minutes"
        />
        {trimmedQuery ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded"
          >
            Clear
          </button>
        ) : null}
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-[#e0e0e0] bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#001e00]">No meeting minutes yet</p>
          <p className="text-sm text-[#5e6d55] mt-1 max-w-sm mx-auto">
            Log your first client call with outcomes, attendees, and follow-up actions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <StatusCard title="Active" records={grouped.Active} />
          <StatusCard title="Hold" records={grouped.Hold} />
          <StatusCard title="Closed" records={grouped.Closed} />
        </div>
      )}
    </div>
  )
}
