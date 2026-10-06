import { prisma } from '@/lib/prisma'
import { formatIst, formatIstWeekdayLong, istDateInputValue } from '@/lib/ist'
import { parseManualBdActivityJson } from '@/lib/bd-activity-manual'
import { businessDayStart } from '@/lib/daily'
import { Fragment } from 'react'
import Link from 'next/link'
import { shortDisplayName } from '@/lib/employee-order'
import { KpiGrid, type Kpi } from '@/components/KpiCard'
import EmptyState from '@/components/EmptyState'
import InitialAvatar from '@/components/InitialAvatar'

const BD_HREF = (from: string, to: string) => `/overview?tab=sales&view=bd&fromDate=${from}&toDate=${to}`

/** YYYY-MM-DD ± days, pure calendar math (no timezone drift). */
function shiftKey(key: string, days: number) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** Quick ranges in IST, ending today. Week starts Monday (same as check-ins). */
function datePresets(todayKey: string) {
  const [y, m, d] = todayKey.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sun
  const mondayOffset = (weekday + 6) % 7
  return [
    { key: 'today', label: 'Today', from: todayKey, to: todayKey },
    { key: 'week', label: 'This week', from: shiftKey(todayKey, -mondayOffset), to: todayKey },
    { key: '7d', label: 'Last 7 days', from: shiftKey(todayKey, -6), to: todayKey },
    { key: 'month', label: 'This month', from: `${todayKey.slice(0, 8)}01`, to: todayKey },
  ]
}

const CHANNEL_CHIP: Record<string, { chip: string; dot: string }> = {
  LinkedIn: { chip: 'bg-sky-50 text-sky-700 ring-sky-100', dot: 'bg-sky-500' },
  Email: { chip: 'bg-violet-50 text-violet-700 ring-violet-100', dot: 'bg-violet-500' },
  WhatsApp: { chip: 'bg-emerald-50 text-emerald-700 ring-emerald-100', dot: 'bg-emerald-500' },
}

function ChannelChip({ channel }: { channel: string }) {
  const c = CHANNEL_CHIP[channel] ?? { chip: 'bg-gray-50 text-gray-600 ring-gray-200', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap ${c.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {channel}
    </span>
  )
}

/** Zero renders as a light grey 0 so the real numbers stand out. */
function Num({ n }: { n: number }) {
  return <span className={n ? 'text-gray-800' : 'text-gray-300'}>{n}</span>
}

/**
 * BD Activity — moved as-is from the former /analytics?tab=bd.
 * Lives under Business → Sales → BD activity (`/overview?tab=sales&view=bd`).
 */
export default async function BdActivitySection({
  fromDate: fromParam,
  toDate: toParam,
}: {
  fromDate?: string
  toDate?: string
}) {
  const fromDate = fromParam ? businessDayStart(fromParam) : businessDayStart()
  const toDate = toParam ? businessDayStart(toParam) : businessDayStart()

  const bdLogs = await prisma.dailyLog.findMany({
    where: { date: { gte: fromDate, lte: toDate } },
    include: {
      member: true,
      tasks: { where: { taskType: 'bd_outreach' } }
    }
  })

  // BD processing
  let totalNewOutreach = 0
  let totalFollowUps = 0
  let totalReplies = 0
  let totalMeetingsBooked = 0
  type MemberStat = { date: Date; member: any; newOutreach: number; followUps: number; replies: number; meetingsBooked: number; touches: number }
  type ProspectStat = { date: Date; member: any; personName: string; channelStats: Map<string, { newOutreach: number; followUps: number; touches: number; replies: number; meetingsBooked: number }>; newOutreach: number; followUps: number; touches: number; replies: number; meetingsBooked: number }
  
  const memberStatsMap = new Map<string, MemberStat>()
  const prospectStatsMap = new Map<string, ProspectStat>()

  for (const log of bdLogs) {
    if (log.tasks.length === 0) continue
    const dateStr = istDateInputValue(log.date)

    for (const task of log.tasks) {
      const rows = parseManualBdActivityJson(task.bdActivityJson)
      
      const memberKey = `${dateStr}_${log.memberId}`
      let memberStats = memberStatsMap.get(memberKey)
      if (!memberStats) {
        memberStats = { date: log.date, member: log.member, newOutreach: 0, followUps: 0, touches: 0, replies: 0, meetingsBooked: 0 }
        memberStatsMap.set(memberKey, memberStats)
      }
      
      for (const row of rows) {
        if (!row.personName.trim()) continue
        const touches = row.newOutreach + row.followUps
        if (touches === 0 && row.replies === 0 && row.meetingsBooked === 0) continue
        
        totalNewOutreach += row.newOutreach
        totalFollowUps += row.followUps
        totalReplies += row.replies
        totalMeetingsBooked += row.meetingsBooked
        
        memberStats.newOutreach += row.newOutreach
        memberStats.followUps += row.followUps
        memberStats.touches += touches
        memberStats.replies += row.replies
        memberStats.meetingsBooked += row.meetingsBooked

        const prospectKey = `${dateStr}_${log.memberId}_${row.personName.toLowerCase().trim()}`
        let prospectStats = prospectStatsMap.get(prospectKey)
        if (!prospectStats) {
          prospectStats = { date: log.date, member: log.member, personName: row.personName.trim(), channelStats: new Map(), newOutreach: 0, followUps: 0, touches: 0, replies: 0, meetingsBooked: 0 }
          prospectStatsMap.set(prospectKey, prospectStats)
        }
        
        let cStat = prospectStats.channelStats.get(row.channel)
        if (!cStat) {
          cStat = { newOutreach: 0, followUps: 0, touches: 0, replies: 0, meetingsBooked: 0 }
          prospectStats.channelStats.set(row.channel, cStat)
        }
        cStat.newOutreach += row.newOutreach
        cStat.followUps += row.followUps
        cStat.touches += touches
        cStat.replies += row.replies
        cStat.meetingsBooked += row.meetingsBooked
        
        prospectStats.newOutreach += row.newOutreach
        prospectStats.followUps += row.followUps
        prospectStats.touches += touches
        prospectStats.replies += row.replies
        prospectStats.meetingsBooked += row.meetingsBooked
      }
    }
  }

  const bdMemberStats = Array.from(memberStatsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime() || b.meetingsBooked - a.meetingsBooked || b.touches - a.touches)
  const bdProspectStats = Array.from(prospectStatsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime() || b.meetingsBooked - a.meetingsBooked || b.touches - a.touches)
  const bdTotalTouches = totalNewOutreach + totalFollowUps

  const fromKey = istDateInputValue(fromDate)
  const toKey = istDateInputValue(toDate)
  const todayKey = istDateInputValue(businessDayStart())
  const presets = datePresets(todayKey)
  const activePreset = presets.find(p => p.from === fromKey && p.to === toKey)?.key
  const dayCount = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1
  const nothingLogged = bdTotalTouches === 0 && totalReplies === 0 && totalMeetingsBooked === 0
  const prospectCount = new Set(bdProspectStats.map(p => p.personName.toLowerCase())).size

  const kpis: Kpi[] = [
    {
      label: 'Total touches',
      value: String(bdTotalTouches),
      sub: `${totalNewOutreach} new · ${totalFollowUps} follow-ups`,
      hint: bdTotalTouches ? undefined : 'Nothing logged in this range',
      tone: bdTotalTouches ? 'normal' : 'muted',
      tint: 'indigo',
      icon: 'touches',
    },
    {
      label: 'Total replies',
      value: String(totalReplies),
      sub: 'Inbound responses',
      hint: bdTotalTouches ? `${Math.round((totalReplies / bdTotalTouches) * 100)}% reply rate` : undefined,
      tone: totalReplies ? 'normal' : 'muted',
      tint: 'sky',
      icon: 'replies',
    },
    {
      label: 'Meetings booked',
      value: String(totalMeetingsBooked),
      sub: 'Outcomes reported',
      hint: totalReplies ? `From ${totalReplies} repl${totalReplies === 1 ? 'y' : 'ies'}` : undefined,
      tone: totalMeetingsBooked ? 'normal' : 'muted',
      tint: 'emerald',
      icon: 'meetings',
    },
    {
      label: 'Conversion (touch → meeting)',
      value: bdTotalTouches > 0 ? `${((totalMeetingsBooked / bdTotalTouches) * 100).toFixed(1)}%` : '—',
      sub: `Touches per meeting: ${totalMeetingsBooked > 0 ? Math.round(bdTotalTouches / totalMeetingsBooked) : '—'}`,
      hint: bdTotalTouches ? undefined : 'Needs at least one touch',
      tone: bdTotalTouches && totalMeetingsBooked ? 'normal' : 'muted',
      tint: 'violet',
      icon: 'conversion',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Range header + date control ─────────────────────────────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
            {fromDate.getTime() === toDate.getTime()
              ? formatIstWeekdayLong(fromDate)
              : `${formatIstWeekdayLong(fromDate)} – ${formatIstWeekdayLong(toDate)}`}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {dayCount > 0 ? `${dayCount} day${dayCount === 1 ? '' : 's'}` : 'Empty range'} · from daily EOD outreach logs
          </p>
        </div>

        {/* Toolbar: chips | divider | [date] – [date] View — one row from lg, two rows below */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:flex-nowrap lg:shrink-0">
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto" aria-label="Quick ranges">
            {presets.map(p => {
              const on = activePreset === p.key
              return (
                <Link
                  key={p.key}
                  href={BD_HREF(p.from, p.to)}
                  scroll={false}
                  aria-current={on ? 'true' : undefined}
                  className={`inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-medium ring-1 ring-inset transition-colors whitespace-nowrap ${
                    on ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </Link>
              )
            })}
          </div>
          <span className="hidden lg:block h-6 w-px shrink-0 bg-gray-200" aria-hidden="true" />
          <form className="flex flex-nowrap items-center gap-2">
            <input type="hidden" name="tab" value="sales" />
            <input type="hidden" name="view" value="bd" />
            <label htmlFor="fromDate" className="sr-only">
              From
            </label>
            <input
              type="date"
              id="fromDate"
              name="fromDate"
              defaultValue={fromKey}
              className="h-9 w-36 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <span className="text-xs text-gray-400" aria-hidden="true">
              –
            </span>
            <label htmlFor="toDate" className="sr-only">
              To
            </label>
            <input
              type="date"
              id="toDate"
              name="toDate"
              defaultValue={toKey}
              className="h-9 w-36 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs tabular-nums text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center rounded-lg bg-gray-900 px-3.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
            >
              View
            </button>
          </form>
        </div>
      </div>

      <KpiGrid kpis={kpis} />

      {/* ── Prospect engagement ─────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              Prospect engagement
              {prospectCount ? <span className="text-gray-400 font-normal"> · {prospectCount} prospect{prospectCount === 1 ? '' : 's'}</span> : null}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Grouped by day and person, most meetings first</p>
          </div>
          {!nothingLogged ? (
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CHANNEL_CHIP).map(c => (
                <ChannelChip key={c} channel={c} />
              ))}
            </div>
          ) : null}
        </div>

        {bdProspectStats.length === 0 ? (
          <EmptyState
            icon="touches"
            title={nothingLogged ? 'No BD activity logged for this period' : 'No prospect data recorded yet'}
            hint={
              <>
                BD logs outreach in their end-of-day update: an <span className="font-medium text-gray-700">Outreach &amp; campaigns</span>{' '}
                task in <span className="font-medium text-gray-700">Daily → EOD</span>, one row per prospect.
                {dayCount < 7 ? ' Try a wider range.' : null}
              </>
            }
            action={
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium">
                <Link href="/daily" className="text-gray-700 hover:text-gray-900">
                  Daily updates →
                </Link>
                <Link href="/daily/eod" className="text-gray-500 hover:text-gray-900">
                  Open EOD →
                </Link>
                {dayCount < 7 ? (
                  <Link
                    href={BD_HREF(presets[2].from, presets[2].to)}
                    scroll={false}
                    className="text-gray-500 hover:text-gray-900"
                  >
                    Last 7 days →
                  </Link>
                ) : null}
              </div>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="text-left pl-5 pr-3 py-2 font-medium">Prospect</th>
                  <th className="text-left px-3 py-2 font-medium">Channel</th>
                  <th className="text-right px-3 py-2 font-medium">New outreach</th>
                  <th className="text-right px-3 py-2 font-medium">Follow-ups</th>
                  <th className="text-right px-3 py-2 font-medium">Replies</th>
                  <th className="text-right pl-3 pr-5 py-2 font-medium">Meetings</th>
                </tr>
              </thead>
              {Array.from(
                bdProspectStats.reduce((acc, p) => {
                  const mName = shortDisplayName(p.member.name)
                  const dateStr = formatIst(p.date, { month: 'short', day: 'numeric' })
                  const groupKey = `${dateStr} – ${mName}`
                  if (!acc.has(groupKey)) acc.set(groupKey, [])
                  acc.get(groupKey)!.push(p)
                  return acc
                }, new Map<string, typeof bdProspectStats>())
              ).map(([groupKey, prospects]) => {
                const totalNew = prospects.reduce((sum, p) => sum + p.newOutreach, 0)
                const totalFollowUps = prospects.reduce((sum, p) => sum + p.followUps, 0)
                const totalReplies = prospects.reduce((sum, p) => sum + p.replies, 0)
                const totalMeetings = prospects.reduce((sum, p) => sum + p.meetingsBooked, 0)
                const first = prospects[0]
                const groupCell = 'py-2 bg-gray-50/80 border-y border-gray-100 text-xs tabular-nums text-right font-semibold text-gray-600'

                return (
                  <tbody key={groupKey} className="divide-y divide-gray-50">
                    <tr>
                      <td colSpan={2} className="pl-5 pr-3 py-2 bg-gray-50/80 border-y border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <InitialAvatar name={first.member.name} size="sm" />
                          <span className="text-xs font-semibold text-gray-700 truncate">{shortDisplayName(first.member.name)}</span>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">
                            {formatIst(first.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">
                            · {prospects.length} prospect{prospects.length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </td>
                      <td className={`px-3 ${groupCell}`}>{totalNew > 0 ? totalNew : ''}</td>
                      <td className={`px-3 ${groupCell}`}>{totalFollowUps > 0 ? totalFollowUps : ''}</td>
                      <td className={`px-3 ${groupCell}`}>{totalReplies > 0 ? totalReplies : ''}</td>
                      <td className={`pl-3 pr-5 ${groupCell} ${totalMeetings > 0 ? 'text-emerald-700' : ''}`}>
                        {totalMeetings > 0 ? totalMeetings : ''}
                      </td>
                    </tr>
                    {prospects.map((p, i) => (
                      <Fragment key={i}>
                        {Array.from(p.channelStats.entries()).map(([channel, stats], cIdx) => (
                          <tr key={`${i}-${cIdx}`} className="hover:bg-gray-50/80 transition-colors">
                            <td className="pl-5 pr-3 py-2 font-medium text-gray-900">
                              {cIdx === 0 ? p.personName : <span className="sr-only">{p.personName}</span>}
                            </td>
                            <td className="px-3 py-2">
                              <ChannelChip channel={channel} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Num n={stats.newOutreach} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Num n={stats.followUps} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <Num n={stats.replies} />
                            </td>
                            <td className="pl-3 pr-5 py-2 text-right tabular-nums">
                              {stats.meetingsBooked > 0 ? (
                                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-emerald-50 px-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                                  {stats.meetingsBooked}
                                </span>
                              ) : (
                                <span className="text-gray-300">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
