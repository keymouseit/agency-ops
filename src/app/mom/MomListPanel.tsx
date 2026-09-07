'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { fmtDate, MOM_MEETING_TYPE_COLORS } from '@/lib/utils'
import {
  filterMomsByQuery,
  followUpStatusLabel,
  type MomSearchable,
} from '@/lib/mom'

type MomRecord = MomSearchable & {
  meetingDate: string | Date
  followUpDate: string | Date | null
  followUpCompletedAt?: string | Date | null
}

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
  }
}

export default function MomListPanel({ records }: { records: MomRecord[] }) {
  const [query, setQuery] = useState('')

  const normalized = useMemo(
    () => records.map(normalizeRecord),
    [records],
  )

  const filtered = useMemo(
    () => filterMomsByQuery(normalized, query),
    [normalized, query],
  )

  const trimmedQuery = query.trim()

  return (
    <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm font-medium text-gray-700">
              {trimmedQuery
                ? `${filtered.length} of ${records.length} meeting${records.length === 1 ? '' : 's'}`
                : `${records.length} meeting${records.length === 1 ? '' : 's'}`}
            </span>
            <span className="text-xs text-gray-400">Newest first · click a row for details</span>
          </div>

          <div className="relative max-w-md">
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
            {trimmedQuery && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-xl mx-auto mb-3">
              📋
            </div>
            <p className="text-sm font-medium text-gray-700">No meeting minutes yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Log your first client call with outcomes, attendees, and follow-up actions.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 px-6">
            <p className="text-sm font-medium text-gray-700">No meetings match your search</p>
            <p className="text-xs text-gray-400 mt-1">
              Try a different client name or company, or{' '}
              <button type="button" onClick={() => setQuery('')} className="text-violet-600 hover:underline">
                clear the search
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold">Meeting</th>
                  <th className="text-left px-4 py-3 font-semibold">Client</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Outcome</th>
                  <th className="text-left px-4 py-3 font-semibold">Follow-up</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Source</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Logged by</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const followUp = followUpStatusLabel(r)
                  const typeColor = MOM_MEETING_TYPE_COLORS[r.meetingType] ?? 'bg-gray-100 text-gray-600'

                  return (
                    <tr
                      key={r.id}
                      className="group border-b border-gray-50 last:border-0 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <Link href={`/mom/${r.id}`} className="block">
                          <div className="font-medium text-gray-900 group-hover:text-gray-950">
                            {fmtDate(r.meetingDate)}
                          </div>
                          {r.meetingTime && (
                            <div className="text-xs text-gray-400 mt-0.5">{r.meetingTime}</div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/mom/${r.id}`} className="block">
                          <div className="font-medium text-gray-900">{r.clientName}</div>
                          {r.companyName && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[160px]">
                              {r.companyName}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`badge ${typeColor}`}>{r.meetingType}</span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell max-w-[200px]">
                        <p className="text-gray-600 truncate" title={r.meetingOutcome ?? undefined}>
                          {r.meetingOutcome || <span className="text-gray-300">—</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        {followUp ? (
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${followUp.cls}`}>
                            {followUp.text}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell text-gray-500 text-xs">
                        {r.leadSource || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <span className="text-xs text-gray-500">{r.createdBy.name.split(' ')[0]}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`/mom/${r.id}`}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 group-hover:text-gray-700 group-hover:bg-gray-100 transition-colors"
                          aria-label={`View ${r.clientName}`}
                        >
                          →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  )
}
