'use client'

import type { BdAccountActivityRow } from '@/lib/salesrobot/bd-activity'

const METRICS = [
  { key: 'newOutreach', label: 'New outreach', hint: 'Connection requests sent' },
  { key: 'followUps', label: 'Follow-ups', hint: 'Messages sent' },
  { key: 'replies', label: 'Replies', hint: 'Inbound replies' },
  { key: 'meetingsBooked', label: 'Meetings booked', hint: 'Meetings booked today' },
] as const

type MetricKey = (typeof METRICS)[number]['key']

export default function EODBdLinkedInActivity({
  rows,
  readOnly = false,
  onChange,
}: {
  rows: BdAccountActivityRow[]
  readOnly?: boolean
  onChange?: (rows: BdAccountActivityRow[]) => void
}) {
  function update(accountId: string, field: MetricKey, value: string) {
    if (!onChange) return
    const n = Math.max(0, Math.floor(Number(value) || 0))
    onChange(
      rows.map(row =>
        row.linkedinAccountId === accountId
          ? { ...row, [field]: n, source: 'manual' as const }
          : row
      )
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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-3 text-sm text-amber-900">
        No SalesRobot LinkedIn accounts synced yet. Run Sync on the SalesRobot page, then reopen EOD.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">BD activity · LinkedIn accounts</div>
          <p className="text-xs text-gray-500 mt-0.5">
            Actual counts for today, by LinkedIn seat. Prefills from SalesRobot — edit if needed.
          </p>
        </div>
        {!readOnly && (
          <span className="text-[11px] text-gray-400">Editable</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm border-collapse">
          <thead>
            <tr className="text-[11px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
              <th className="text-left font-medium px-4 py-2.5">Account</th>
              {METRICS.map(m => (
                <th key={m.key} className="text-right font-medium px-3 py-2.5 whitespace-nowrap" title={m.hint}>
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.linkedinAccountId} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-900">{row.accountName}</div>
                  <div className="text-[11px] text-gray-400">
                    {row.source === 'salesrobot' ? 'From SalesRobot' : 'Manual'}
                  </div>
                </td>
                {METRICS.map(m => (
                  <td key={m.key} className="px-3 py-2 text-right">
                    {readOnly ? (
                      <span className="tabular-nums text-gray-800">{row[m.key]}</span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={row[m.key]}
                        onChange={e => update(row.linkedinAccountId, m.key, e.target.value)}
                        className="w-20 ml-auto block rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-right text-sm tabular-nums focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-gray-50 border-t border-gray-200">
              <td className="px-4 py-2.5 text-sm font-semibold text-gray-900">Total</td>
              {METRICS.map(m => (
                <td key={m.key} className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900">
                  {totals[m.key]}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-gray-400 border-t border-gray-100">
        New outreach = connection requests · Follow-ups = messages sent · Replies = inbound replies.
        Meetings booked are entered manually.
      </p>
    </div>
  )
}
