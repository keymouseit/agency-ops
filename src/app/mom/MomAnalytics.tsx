import { fmtDate, LEAD_SOURCES, MOM_MEETING_TYPES } from '@/lib/utils'
import { isFollowUpPending } from '@/lib/mom'
import {
  differenceInDays,
  endOfMonth,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns'

type MomRecord = {
  meetingDate: Date
  meetingType: string
  leadSource: string | null
  domain: string | null
  followUpDate: Date | null
  followUpCompletedAt?: Date | null
  meetingVideoPath: string | null
  meetingVideoUrl: string | null
  clientName: string
  companyName: string | null
  createdBy: { name: string }
}

const TYPE_BAR_COLORS: Record<string, string> = {
  'Discovery Call': 'bg-violet-400',
  'Demo': 'bg-blue-400',
  'Follow-up': 'bg-amber-400',
  'Proposal Discussion': 'bg-green-400',
}

const BAR_COLORS = ['bg-blue-400', 'bg-violet-400', 'bg-amber-400', 'bg-green-400', 'bg-teal-400', 'bg-rose-400']

function BarChart({
  title,
  rows,
}: {
  title: string
  rows: { label: string; count: number; color?: string }[]
}) {
  const max = Math.max(...rows.map(r => r.count), 1)
  if (!rows.length) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
        <p className="text-xs text-gray-400">No data yet</p>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={row.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 truncate pr-2">{row.label}</span>
              <span className="font-semibold text-gray-900 shrink-0">{row.count}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${row.color ?? BAR_COLORS[i % BAR_COLORS.length]}`}
                style={{ width: `${Math.round((row.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MomAnalytics({ records }: { records: MomRecord[] }) {
  const today = startOfDay(new Date())

  const followUpOverdue = records.filter(r =>
    isFollowUpPending(r) && differenceInDays(startOfDay(r.followUpDate!), today) < 0
  ).length
  const followUpToday = records.filter(r =>
    isFollowUpPending(r) && differenceInDays(startOfDay(r.followUpDate!), today) === 0
  ).length
  const followUpWeek = records.filter(r => {
    if (!isFollowUpPending(r)) return false
    const d = differenceInDays(startOfDay(r.followUpDate!), today)
    return d > 0 && d <= 7
  }).length
  const followUpCompleted = records.filter(r => r.followUpDate && r.followUpCompletedAt).length

  const byType = MOM_MEETING_TYPES.map(type => ({
    label: type,
    count: records.filter(r => r.meetingType === type).length,
    color: TYPE_BAR_COLORS[type] ?? 'bg-gray-400',
  })).filter(r => r.count > 0)

  const bySource = LEAD_SOURCES.map(source => ({
    label: source,
    count: records.filter(r => r.leadSource === source).length,
  })).filter(r => r.count > 0)

  const unknownSource = records.filter(r => r.leadSource && !LEAD_SOURCES.includes(r.leadSource as typeof LEAD_SOURCES[number])).length
  if (unknownSource > 0) {
    bySource.push({ label: 'Other' as any, count: unknownSource })
  }

  const byLogger = Object.entries(
    records.reduce<Record<string, number>>((acc, r) => {
      const name = r.createdBy.name.split(' ')[0]
      acc[name] = (acc[name] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const byDomain = Object.entries(
    records.reduce<Record<string, number>>((acc, r) => {
      const d = r.domain?.trim()
      if (!d) return acc
      acc[d] = (acc[d] ?? 0) + 1
      return acc
    }, {})
  )
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const monthTrend = [3, 2, 1, 0].map(offset => {
    const monthStart = startOfMonth(subMonths(today, offset))
    const monthEnd = endOfMonth(monthStart)
    return {
      label: format(monthStart, 'MMM yyyy'),
      count: records.filter(r =>
        isWithinInterval(r.meetingDate, { start: monthStart, end: monthEnd })
      ).length,
    }
  })

  const withRecording = records.filter(r => r.meetingVideoPath || r.meetingVideoUrl).length
  const recordingPct = records.length ? Math.round((withRecording / records.length) * 100) : 0
  const uniqueClients = new Set(records.map(r => `${r.clientName}|${r.companyName ?? ''}`)).size

  const upcomingFollowUps = records
    .filter(r => isFollowUpPending(r) && differenceInDays(startOfDay(r.followUpDate!), today) >= 0)
    .sort((a, b) => a.followUpDate!.getTime() - b.followUpDate!.getTime())
    .slice(0, 4)

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Analytics</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">{uniqueClients}</div>
          <div className="text-xs text-gray-500 mt-0.5">Unique clients</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-bold text-gray-900">{recordingPct}%</div>
          <div className="text-xs text-gray-500 mt-0.5">Meetings with recording</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <BarChart title="Meetings by type" rows={byType} />
        <BarChart title="Meetings by lead source" rows={bySource} />
        <BarChart title="Logged by team member" rows={byLogger} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Monthly trend</h3>
          <div className="flex items-end gap-3 h-32">
            {monthTrend.map(m => {
              const max = Math.max(...monthTrend.map(x => x.count), 1)
              const height = Math.max(8, Math.round((m.count / max) * 100))
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-gray-900">{m.count}</span>
                  <div
                    className="w-full bg-blue-400 rounded-t-md transition-all"
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-gray-400 text-center leading-tight">{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Follow-up pipeline</h3>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'Overdue', count: followUpOverdue, cls: 'bg-red-50 text-red-700 border-red-100' },
              { label: 'Due today', count: followUpToday, cls: 'bg-amber-50 text-amber-800 border-amber-100' },
              { label: 'This week', count: followUpWeek, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: 'Completed', count: followUpCompleted, cls: 'bg-green-50 text-green-700 border-green-100' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg border px-3 py-2 ${item.cls}`}>
                <div className="text-lg font-bold">{item.count}</div>
                <div className="text-[10px] uppercase tracking-wide opacity-80">{item.label}</div>
              </div>
            ))}
          </div>
          {upcomingFollowUps.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium mb-2">Next up</div>
              <div className="space-y-1.5">
                {upcomingFollowUps.map(r => (
                  <div key={`${r.clientName}-${r.followUpDate}`} className="flex justify-between text-xs">
                    <span className="text-gray-700 truncate pr-2">{r.clientName}</span>
                    <span className="text-gray-500 shrink-0">{fmtDate(r.followUpDate!)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <BarChart title="Top industries / domains" rows={byDomain} />
      </div>
    </div>
  )
}
