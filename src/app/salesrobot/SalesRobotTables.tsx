import type { ReactNode } from 'react'
import { acceptanceRate, replyRate } from '@/lib/salesrobot/metrics'

function pct(n: number) {
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`
}

function RateCell({
  value,
  denominator,
  tone = 'gray',
}: {
  value: number
  denominator: number
  tone?: 'teal' | 'amber' | 'gray'
}) {
  if (!denominator) {
    return <span className="text-gray-400">—</span>
  }

  const width = Math.max(0, Math.min(100, value))
  const bar =
    tone === 'teal' ? 'bg-teal-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-gray-400'
  const track =
    tone === 'teal' ? 'bg-teal-50' : tone === 'amber' ? 'bg-amber-50' : 'bg-gray-100'

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      <div className={`hidden sm:block h-1.5 w-10 rounded-full ${track} overflow-hidden`}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${width}%` }} />
      </div>
      <span className="font-medium text-gray-800 tabular-nums">{pct(value)}</span>
    </div>
  )
}

export function SalesRobotKpiGrid({
  kpis,
}: {
  kpis: Array<{ label: string; value: string; hint?: string; accent?: string }>
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
      {kpis.map(k => (
        <div
          key={k.label}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm relative overflow-hidden"
        >
          <div className={`absolute inset-x-0 top-0 h-0.5 ${k.accent || 'bg-gray-200'}`} />
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-medium">
            {k.label}
          </div>
          <div className="text-2xl font-semibold text-gray-900 mt-1.5 tabular-nums tracking-tight">
            {k.value}
          </div>
          {k.hint && <div className="text-[11px] text-gray-400 mt-1 leading-snug">{k.hint}</div>}
        </div>
      ))}
    </div>
  )
}

function TableShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function SalesRobotWeeklyTable({
  rows,
}: {
  rows: Array<{
    id: string
    weekLabel: string
    campaignName: string
    prospectsAdded: number
    connectionRequestsSent: number
    connectionsAccepted: number
    messagesSent: number
    repliesReceived: number
  }>
}) {
  const activeRows = rows.filter(
    r =>
      r.prospectsAdded > 0 ||
      r.connectionRequestsSent > 0 ||
      r.connectionsAccepted > 0 ||
      r.messagesSent > 0 ||
      r.repliesReceived > 0
  )
  const hiddenZeros = rows.length - activeRows.length
  const display = activeRows.length > 0 ? activeRows : rows

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
        No weekly rows for this range.
      </div>
    )
  }

  return (
    <TableShell
      title="Weekly performance"
      subtitle={
        hiddenZeros > 0
          ? `${display.length} active rows · ${hiddenZeros} empty weeks hidden`
          : `${display.length} week × campaign rows`
      }
    >
      <div className="max-h-[480px] overflow-y-auto">
        <table className="w-full min-w-[920px] text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-3 whitespace-nowrap">Week</th>
              <th className="text-left font-medium px-4 py-3">Campaign</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Prospects</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Requests</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Connections</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Messages</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Replies</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Accept %</th>
              <th className="text-right font-medium px-4 py-3 whitespace-nowrap">Reply %</th>
            </tr>
          </thead>
          <tbody>
            {display.map(row => {
              const accept = acceptanceRate(row.connectionsAccepted, row.connectionRequestsSent)
              const reply = replyRate(
                row.repliesReceived,
                row.messagesSent,
                row.connectionsAccepted
              )
              return (
                <tr
                  key={row.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80"
                >
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">
                    {row.weekLabel}
                  </td>
                  <td className="px-4 py-2.5 text-gray-900 font-medium" title={row.campaignName}>
                    <span className="line-clamp-1">{row.campaignName}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.prospectsAdded}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.connectionRequestsSent}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.connectionsAccepted}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.messagesSent}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.repliesReceived}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <RateCell value={accept} denominator={row.connectionRequestsSent} tone="teal" />
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <RateCell
                      value={reply}
                      denominator={row.messagesSent || row.connectionsAccepted}
                      tone="amber"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TableShell>
  )
}

export function SalesRobotCampaignTable({
  rows,
}: {
  rows: Array<{
    campaignId: string
    name: string
    connectionRequestsSent: number
    connectionsAccepted: number
    messagesSent: number
    repliesReceived: number
  }>
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-500">
        No campaign stats for this range.
      </div>
    )
  }

  return (
    <TableShell
      title="Campaign comparison"
      subtitle="Sorted by requests sent · reply % = replies ÷ messages"
    >
      <div className="max-h-[480px] overflow-y-auto">
        <table className="w-full min-w-[860px] text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
            <tr className="text-[11px] text-gray-500 uppercase tracking-wide">
              <th className="text-left font-medium px-4 py-3">Campaign</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Requests</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Connections</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Messages</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Replies</th>
              <th className="text-right font-medium px-3 py-3 whitespace-nowrap">Accept %</th>
              <th className="text-right font-medium px-4 py-3 whitespace-nowrap">Reply %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const accept = acceptanceRate(row.connectionsAccepted, row.connectionRequestsSent)
              const reply = replyRate(
                row.repliesReceived,
                row.messagesSent,
                row.connectionsAccepted
              )
              return (
                <tr
                  key={row.campaignId}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50/80"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-500">
                        {i + 1}
                      </span>
                      <span className="font-medium text-gray-900 line-clamp-1" title={row.name}>
                        {row.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.connectionRequestsSent}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.connectionsAccepted}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.messagesSent}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {row.repliesReceived}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <RateCell
                      value={accept}
                      denominator={row.connectionRequestsSent}
                      tone="teal"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <RateCell
                      value={reply}
                      denominator={row.messagesSent || row.connectionsAccepted}
                      tone="amber"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TableShell>
  )
}

export function SalesRobotEventsTable({
  events,
}: {
  events: Array<{
    id: string
    when: string
    eventType: string
    campaign: string
    prospectId: string
    processed: boolean
  }>
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-900">Recent webhook events</h2>
        <p className="text-xs text-gray-500 mt-0.5">Live activity from SalesRobot webhooks</p>
      </div>
      {events.length === 0 ? (
        <div className="px-5 py-5 text-sm text-gray-500">
          No webhook events yet. Configure SalesRobot to send events to{' '}
          <code className="font-mono text-[11px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
            POST /api/integrations/salesrobot/webhook
          </code>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-[11px] text-gray-500 uppercase tracking-wide bg-gray-50 border-b border-gray-200">
                <th className="text-left font-medium px-4 py-3">When</th>
                <th className="text-left font-medium px-3 py-3">Type</th>
                <th className="text-left font-medium px-3 py-3">Campaign</th>
                <th className="text-left font-medium px-3 py-3">Prospect</th>
                <th className="text-left font-medium px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map(ev => (
                <tr key={ev.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs">{ev.when}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {ev.eventType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-800">{ev.campaign}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{ev.prospectId}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        ev.processed
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {ev.processed ? 'Processed' : 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
