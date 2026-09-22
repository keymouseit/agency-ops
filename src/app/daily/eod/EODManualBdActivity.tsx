'use client'

import React, { useEffect, useState, Fragment } from 'react'
import type { ManualBdActivityRow } from '@/lib/bd-activity-manual'

const METRICS = [
  { key: 'newOutreach', label: 'New outreach', hint: 'Connection requests / initial emails sent' },
  { key: 'followUps', label: 'Follow-ups', hint: 'Follow up messages sent' },
  { key: 'replies', label: 'Replies', hint: 'Inbound replies received' },
  { key: 'meetingsBooked', label: 'Meetings booked', hint: 'Meetings booked today' },
] as const

type MetricKey = (typeof METRICS)[number]['key']
const CHANNELS = ['Email', 'WhatsApp', 'LinkedIn'] as const

const ICONS: Record<string, React.ReactNode> = {
  Email: (
    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  WhatsApp: (
    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
  ),
  LinkedIn: (
    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
}

export default function EODManualBdActivity({
  rows,
  readOnly = false,
  onChange,
}: {
  rows: ManualBdActivityRow[]
  readOnly?: boolean
  onChange?: (rows: ManualBdActivityRow[]) => void
}) {
  // Group rows into chunks of 3 for each person
  const chunks: ManualBdActivityRow[][] = []
  for (let i = 0; i < rows.length; i += 3) {
    chunks.push(rows.slice(i, i + 3))
  }

  useEffect(() => {
    if (!readOnly && rows.length === 0 && onChange) {
      const defaultPersons = [
        'Kanika Sharma',
        'Shiven Juneja',
        'Sushant Sharma',
        'Vishal Ghangale'
      ]
      
      const defaultRows: ManualBdActivityRow[] = []
      for (const name of defaultPersons) {
        const baseId = Math.random().toString(36).slice(2)
        CHANNELS.forEach(channel => {
          defaultRows.push({
            id: `${baseId}-${channel}`,
            personName: name,
            channel,
            newOutreach: 0,
            followUps: 0,
            replies: 0,
            meetingsBooked: 0,
          })
        })
      }
      // Use setTimeout to avoid synchronous state updates during initial render if this is a child
      setTimeout(() => onChange(defaultRows), 0)
    }
  }, [readOnly, rows.length]) // Intentionally not including onChange to prevent loops if it's unstable

  function addPerson() {
    if (!onChange) return
    const baseId = Math.random().toString(36).slice(2)
    onChange([
      ...rows,
      ...CHANNELS.map(channel => ({
        id: `${baseId}-${channel}`,
        personName: '',
        channel,
        newOutreach: 0,
        followUps: 0,
        replies: 0,
        meetingsBooked: 0,
      }))
    ])
  }

  function removePerson(chunkIndex: number) {
    if (!onChange) return
    const newRows = [...rows]
    newRows.splice(chunkIndex * 3, 3)
    onChange(newRows)
  }

  function updatePersonName(chunkIndex: number, name: string) {
    if (!onChange) return
    const newRows = [...rows]
    for (let i = 0; i < 3; i++) {
      if (newRows[chunkIndex * 3 + i]) {
        newRows[chunkIndex * 3 + i] = { ...newRows[chunkIndex * 3 + i], personName: name }
      }
    }
    onChange(newRows)
  }

  function updateMetric(id: string, field: MetricKey, value: string) {
    if (!onChange) return
    onChange(
      rows.map(row => {
        if (row.id !== id) return row
        const n = Math.max(0, Math.floor(Number(value) || 0))
        return { ...row, [field]: n }
      })
    )
  }

  const totals = rows.reduce(
    (acc, row) => ({
      newOutreach: acc.newOutreach + row.newOutreach,
      followUps: acc.followUps + row.followUps,
      replies: acc.replies + row.replies,
      meetingsBooked: acc.meetingsBooked + row.meetingsBooked,
    }),
    { newOutreach: 0, followUps: 0, replies: 0, meetingsBooked: 0 }
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mt-4">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div className="text-base font-semibold text-gray-900">BD activity</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Actual counts for today, by person and channel. Enter 0 when there was no activity.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addPerson}
            className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            + Add Person
          </button>
        )}
      </div>

      {chunks.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-gray-500 bg-gray-50/50">
          No BD activity logged yet. Click "+ Add Person" to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm border-collapse">
            <thead>
              <tr className="text-xs text-gray-500 font-medium tracking-wide bg-white border-b border-gray-100">
                <th className="text-left px-5 py-3 w-48 font-medium">Person</th>
                <th className="text-left px-5 py-3 w-40 font-medium">Channel</th>
                {METRICS.map(m => (
                  <th key={m.key} className="text-center px-4 py-3 whitespace-nowrap font-medium" title={m.hint}>
                    {m.label} <span className="text-gray-300 ml-0.5" title={m.hint}>ⓘ</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chunks.map((chunk, chunkIndex) => {
                const personName = chunk[0]?.personName || ''
                return (
                  <React.Fragment key={chunkIndex}>
                    {chunk.map((row, rowIndex) => (
                      <tr key={row.id} className="bg-white hover:bg-gray-50/30 transition-colors">
                        {rowIndex === 0 && (
                          <td rowSpan={3} className="px-5 py-4 border-r border-gray-100 align-top bg-gray-50/30">
                            <div className="space-y-3">
                              {readOnly ? (
                                <span className="font-semibold text-gray-900 block">{personName || '—'}</span>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Name"
                                  value={personName}
                                  onChange={e => updatePersonName(chunkIndex, e.target.value)}
                                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-gray-300 transition-colors"
                                />
                              )}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => removePerson(chunkIndex)}
                                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                                >
                                  Remove person
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 shrink-0">
                              {ICONS[row.channel]}
                            </div>
                            <span className="font-medium text-gray-700">{row.channel}</span>
                          </div>
                        </td>
                        {METRICS.map(m => (
                          <td key={m.key} className="px-4 py-3 text-center">
                            {readOnly ? (
                              <span className="tabular-nums text-gray-800 text-base">{row[m.key]}</span>
                            ) : (
                              <div className="flex justify-center">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row[m.key]}
                                  onChange={e => updateMetric(row.id, m.key, e.target.value)}
                                  className="w-20 block rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm tabular-nums shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 hover:border-gray-300 transition-colors"
                                />
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
              <tr className="bg-gray-50/80 border-t-2 border-gray-100">
                <td colSpan={2} className="px-5 py-4 text-sm font-bold text-gray-900 text-right">Total</td>
                {METRICS.map(m => (
                  <td key={m.key} className="px-4 py-4 text-center text-sm font-bold tabular-nums text-gray-900">
                    {totals[m.key]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 bg-white">
        <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <span className="text-gray-300">ⓘ</span> Outbound touches = new outreach + follow-ups. Booked meetings are reported outcomes, not scheduled call records.
        </p>
      </div>
    </div>
  )
}
