import { prisma } from '@/lib/prisma'
import { avg, fmtCurrency, formatLossReason } from '@/lib/utils'
import { startOfWeek, subWeeks } from 'date-fns'
import { formatIst, formatIstWeekdayLong, istDateInputValue } from '@/lib/ist'
import Link from 'next/link'
import { parseManualBdActivityJson } from '@/lib/bd-activity-manual'
import { businessDayStart } from '@/lib/daily'
import { Fragment } from 'react'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { tab?: string; fromDate?: string; toDate?: string }
}) {
  const activeTab = searchParams.tab === 'bd' ? 'bd' : 'general'
  const fromDate = searchParams.fromDate ? businessDayStart(searchParams.fromDate) : businessDayStart()
  const toDate = searchParams.toDate ? businessDayStart(searchParams.toDate) : businessDayStart()

  const [leads, projects, scores, members, lossAnalyses, bdLogs] = await Promise.all([
    prisma.lead.findMany({ include: { owner: true, lossAnalysis: true } }),
    prisma.project.findMany({ include: { developer: true, scopeChanges: true, postMortem: true } }),
    prisma.weeklyScore.findMany({
      where: { weekOf: { gte: subWeeks(startOfWeek(new Date()), 7) } },
      include: { member: true },
      orderBy: { weekOf: 'asc' },
    }),
    prisma.teamMember.findMany({ where: { active: true } }),
    prisma.lossAnalysis.findMany({ include: { lead: { include: { owner: true } } } }),
    activeTab === 'bd' ? prisma.dailyLog.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      include: {
        member: true,
        tasks: { where: { taskType: 'bd_outreach' } }
      }
    }) : Promise.resolve([]),
  ])

  // BD processing
  let totalNewOutreach = 0
  let totalFollowUps = 0
  let totalReplies = 0
  let totalMeetingsBooked = 0
  type MemberStat = { date: Date; member: any; newOutreach: number; followUps: number; replies: number; meetingsBooked: number; touches: number }
  type ProspectStat = { date: Date; member: any; personName: string; channelStats: Map<string, { newOutreach: number; followUps: number; touches: number; replies: number; meetingsBooked: number }>; newOutreach: number; followUps: number; touches: number; replies: number; meetingsBooked: number }
  
  const memberStatsMap = new Map<string, MemberStat>()
  const prospectStatsMap = new Map<string, ProspectStat>()

  if (activeTab === 'bd') {
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
  }

  const bdMemberStats = Array.from(memberStatsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime() || b.meetingsBooked - a.meetingsBooked || b.touches - a.touches)
  const bdProspectStats = Array.from(prospectStatsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime() || b.meetingsBooked - a.meetingsBooked || b.touches - a.touches)
  const bdTotalTouches = totalNewOutreach + totalFollowUps

  // BD win/loss by owner
  const closedLeads = leads.filter(l => ['won', 'lost'].includes(l.status))
  const byOwner = members.map(m => {
    const mine = closedLeads.filter(l => l.owner.id === m.id)
    const won = mine.filter(l => l.status === 'won')
    const lost = mine.filter(l => l.status === 'lost')
    const wr = mine.length ? Math.round((won.length / mine.length) * 100) : 0
    const wonValue = won.reduce((s, l) => s + (l.budget || 0), 0)
    return { member: m, total: mine.length, won: won.length, lost: lost.length, wr, wonValue }
  }).filter(r => r.total > 0).sort((a, b) => b.wonValue - a.wonValue)

  // Loss reason breakdown
  const lossReasonCount = lossAnalyses.reduce((acc, la) => {
    acc[la.reason] = (acc[la.reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const lossByFault = lossAnalyses.reduce((acc, la) => {
    acc[la.faultArea] = (acc[la.faultArea] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Estimation accuracy
  const deliveredWithData = projects.filter(p => p.status === 'delivered' && p.actualHours && p.estimatedHours)
  const avgAccuracy = deliveredWithData.length
    ? avg(deliveredWithData.map(p => (p.actualHours! / p.estimatedHours!) * 100))
    : null
  const onTimeRate = deliveredWithData.length
    ? Math.round((deliveredWithData.filter(p => p.onTime).length / deliveredWithData.length) * 100)
    : null

  // Scope change stats
  const allScopeChanges = projects.flatMap(p => p.scopeChanges)
  const unsignedRate = allScopeChanges.length
    ? Math.round((allScopeChanges.filter(s => !s.changeOrderSigned).length / allScopeChanges.length) * 100)
    : 0

  // Score trends (weekly averages, last 8 weeks)
  const weeks = Array.from({ length: 8 }, (_, i) => startOfWeek(subWeeks(new Date(), 7 - i)))
  const weeklyAvgs = weeks.map(w => {
    const ws = scores.filter(s => s.weekOf.toISOString().slice(0, 10) === w.toISOString().slice(0, 10))
    return {
      week: w,
      delivery: ws.length ? avg(ws.map(s => s.delivery)) : null,
      process: ws.length ? avg(ws.map(s => s.process)) : null,
      culture: ws.length ? avg(ws.map(s => s.culture)) : null,
    }
  })

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Analytics</h1>
      <p className="text-sm text-gray-500 mb-6">The numbers that tell you where the business is actually healthy — and where it isn't.</p>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-8">
        <Link 
          href="/analytics" 
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          General
        </Link>
        <Link 
          href="/analytics?tab=bd" 
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'bd' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          BD Activity
        </Link>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Top KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Overall win rate', value: closedLeads.length ? `${Math.round((closedLeads.filter(l => l.status === 'won').length / closedLeads.length) * 100)}%` : '—', sub: `${closedLeads.filter(l => l.status === 'won').length} won of ${closedLeads.length} closed` },
          { label: 'Avg estimation accuracy', value: avgAccuracy ? `${Math.round(avgAccuracy)}%` : '—', sub: 'actual / estimated hours · target <120%', danger: avgAccuracy != null && avgAccuracy > 120 },
          { label: 'On-time delivery rate', value: onTimeRate != null ? `${onTimeRate}%` : '—', sub: `${deliveredWithData.filter(p => p.onTime).length} of ${deliveredWithData.length} delivered on time` },
          { label: 'Unsigned scope COs', value: `${unsignedRate}%`, sub: `${allScopeChanges.filter(s => !s.changeOrderSigned).length} of ${allScopeChanges.length} scope changes`, danger: unsignedRate > 30 },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.danger ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* BD by owner */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">BD performance by owner</h2>
          {byOwner.length === 0
            ? <p className="text-sm text-gray-400">No closed leads yet.</p>
            : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left pb-2 font-medium">Owner</th>
                    <th className="text-center pb-2 font-medium">Win rate</th>
                    <th className="text-center pb-2 font-medium">Won</th>
                    <th className="text-center pb-2 font-medium">Lost</th>
                    <th className="text-right pb-2 font-medium">Value won</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {byOwner.map(r => (
                    <tr key={r.member.id}>
                      <td className="py-2 font-medium text-gray-800">{r.member.name}</td>
                      <td className="text-center py-2">
                        <span className={`font-semibold ${r.wr >= 50 ? 'text-green-700' : r.wr >= 30 ? 'text-amber-700' : 'text-red-600'}`}>{r.wr}%</span>
                      </td>
                      <td className="text-center py-2 text-green-700">{r.won}</td>
                      <td className="text-center py-2 text-red-600">{r.lost}</td>
                      <td className="text-right py-2 text-gray-700">{fmtCurrency(r.wonValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>

        {/* Loss reasons */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Why we lose — pattern analysis</h2>
          {Object.keys(lossReasonCount).length === 0
            ? <p className="text-sm text-gray-400">No loss analyses recorded yet. Add them in Pipeline.</p>
            : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">By reason</div>
                  {(Object.entries(lossReasonCount) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex items-center gap-2 mb-1">
                      <div className="text-xs text-gray-600 w-36">{formatLossReason(reason)}</div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(count / lossAnalyses.length) * 100}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 w-4">{count}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-50 pt-3">
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">By fault area</div>
                  {(Object.entries(lossByFault) as [string, number][]).sort((a, b) => b[1] - a[1]).map(([area, count]) => (
                    <div key={area} className="flex items-center gap-2 mb-1">
                      <div className="text-xs text-gray-600 w-36">{area}</div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(count / lossAnalyses.length) * 100}%` }} />
                      </div>
                      <div className="text-xs text-gray-500 w-4">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Score trend over 8 weeks */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Team score trends — last 8 weeks</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400">
                <th className="text-left pb-2 font-medium">Week</th>
                {weeklyAvgs.map((w, i) => (
                  <th key={i} className="text-center pb-2 font-medium">{formatIst(w.week, { day: 'numeric', month: 'short' })}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {['delivery', 'process', 'culture'].map(dim => (
                <tr key={dim}>
                  <td className="py-2 text-gray-500 capitalize font-medium">{dim}</td>
                  {weeklyAvgs.map((w, i) => {
                    const v = w[dim as keyof typeof w] as number | null
                    return (
                      <td key={i} className="text-center py-2">
                        {v != null
                          ? <span className={`font-semibold ${v >= 8 ? 'text-green-700' : v >= 6 ? 'text-amber-700' : 'text-red-600'}`}>{v.toFixed(1)}</span>
                          : <span className="text-gray-200">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Project estimation tracker */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Estimation accuracy by project owner</h2>
        {deliveredWithData.length === 0
          ? <p className="text-sm text-gray-400">No delivered projects with hour data yet.</p>
          : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Project</th>
                  <th className="text-left pb-2 font-medium">Owner</th>
                  <th className="text-center pb-2 font-medium">Est. hrs</th>
                  <th className="text-center pb-2 font-medium">Actual hrs</th>
                  <th className="text-center pb-2 font-medium">Accuracy</th>
                  <th className="text-center pb-2 font-medium">On time</th>
                  <th className="text-center pb-2 font-medium">Client score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deliveredWithData.map(p => {
                  const acc = Math.round((p.actualHours! / p.estimatedHours!) * 100)
                  return (
                    <tr key={p.id}>
                      <td className="py-2 font-medium text-gray-800">{p.name}</td>
                      <td className="py-2 text-gray-500">{p.developer.name}</td>
                      <td className="text-center py-2">{p.estimatedHours}h</td>
                      <td className="text-center py-2">{p.actualHours}h</td>
                      <td className="text-center py-2">
                        <span className={`font-semibold ${acc <= 110 ? 'text-green-700' : acc <= 130 ? 'text-amber-700' : 'text-red-600'}`}>{acc}%</span>
                      </td>
                      <td className="text-center py-2">
                        {p.onTime ? <span className="text-green-600">✓</span> : <span className="text-red-500">✗</span>}
                      </td>
                      <td className="text-center py-2">
                        {p.clientScore
                          ? <span className={p.clientScore >= 8 ? 'text-green-700 font-semibold' : p.clientScore >= 6 ? 'text-amber-700 font-semibold' : 'text-red-600 font-semibold'}>{p.clientScore}/10</span>
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      )}

      {activeTab === 'bd' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-gray-900">
              {fromDate.getTime() === toDate.getTime() 
                ? formatIstWeekdayLong(fromDate)
                : `${formatIstWeekdayLong(fromDate)} – ${formatIstWeekdayLong(toDate)}`}
            </h2>
            <form className="flex items-center gap-3">
              <input type="hidden" name="tab" value="bd" />
              <label htmlFor="fromDate" className="text-sm text-gray-500 font-medium">From:</label>
              <input 
                type="date" 
                id="fromDate"
                name="fromDate" 
                defaultValue={istDateInputValue(fromDate)} 
                className="input text-sm w-auto py-1.5"
              />
              <label htmlFor="toDate" className="text-sm text-gray-500 font-medium">To:</label>
              <input 
                type="date" 
                id="toDate"
                name="toDate" 
                defaultValue={istDateInputValue(toDate)} 
                className="input text-sm w-auto py-1.5"
              />
              <button type="submit" className="bg-gray-900 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors">
                View
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="card p-5">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Total Touches</div>
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{bdTotalTouches}</div>
              <div className="text-xs text-gray-400 mt-1">{totalNewOutreach} new · {totalFollowUps} follow-ups</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Total Replies</div>
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{totalReplies}</div>
              <div className="text-xs text-gray-400 mt-1">Inbound responses</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Meetings Booked</div>
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{totalMeetingsBooked}</div>
              <div className="text-xs text-gray-400 mt-1">Outcomes reported</div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Conversion (Touch → Meeting)</div>
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">
                {bdTotalTouches > 0 ? ((totalMeetingsBooked / bdTotalTouches) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-gray-400 mt-1">Touches per meeting: {totalMeetingsBooked > 0 ? Math.round(bdTotalTouches / totalMeetingsBooked) : '—'}</div>
            </div>
          </div>

          <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
                <h2 className="text-sm font-semibold text-gray-900">Prospect Engagement</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr className="text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-medium">Prospect</th>
                      <th className="text-left px-5 py-3 font-medium">Channel</th>
                      <th className="text-center px-4 py-3 font-medium">New Outreach</th>
                      <th className="text-center px-4 py-3 font-medium">Follow-ups</th>
                      <th className="text-center px-4 py-3 font-medium">Replies</th>
                      <th className="text-center px-4 py-3 font-medium">Meetings</th>
                    </tr>
                  </thead>
                  {bdProspectStats.length === 0 ? (
                    <tbody className="bg-white">
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                          No prospect data recorded yet.
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    Array.from(
                      bdProspectStats.reduce((acc, p) => {
                        const mName = p.member.name.split(' ')[0]
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

                      return (
                      <tbody key={groupKey} className="divide-y divide-gray-50 bg-white">
                        <tr>
                          <td colSpan={2} className="px-5 py-2.5 text-[11px] font-bold text-gray-600 uppercase tracking-wider bg-gray-50 border-t border-b border-gray-100">
                            {groupKey}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-600 tabular-nums bg-gray-50 border-t border-b border-gray-100">
                            {totalNew > 0 ? totalNew : ''}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-600 tabular-nums bg-gray-50 border-t border-b border-gray-100">
                            {totalFollowUps > 0 ? totalFollowUps : ''}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-600 tabular-nums bg-gray-50 border-t border-b border-gray-100">
                            {totalReplies > 0 ? totalReplies : ''}
                          </td>
                          <td className="px-4 py-2.5 text-center text-[11px] font-bold text-indigo-600 tabular-nums bg-gray-50 border-t border-b border-gray-100">
                            {totalMeetings > 0 ? totalMeetings : ''}
                          </td>
                        </tr>
                        {prospects.map((p, i) => (
                          <Fragment key={i}>
                            {Array.from(p.channelStats.entries()).map(([channel, stats], cIdx) => (
                              <tr key={`${i}-${cIdx}`} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-5 py-3 font-medium text-gray-900">
                                  {cIdx === 0 ? p.personName : ''}
                                </td>
                                <td className="px-5 py-3">
                                  <span className="badge bg-gray-100 text-gray-600 text-[10px]">{channel}</span>
                                </td>
                                <td className="px-4 py-3 text-center tabular-nums text-gray-700">{stats.newOutreach}</td>
                                <td className="px-4 py-3 text-center tabular-nums text-gray-700">{stats.followUps}</td>
                                <td className="px-4 py-3 text-center tabular-nums text-gray-700">{stats.replies}</td>
                                <td className="px-4 py-3 text-center tabular-nums">
                                  {stats.meetingsBooked > 0 ? (
                                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 font-semibold text-xs">
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
                    );
                  })
                  )}
                </table>
              </div>
            </div>
        </div>
      )}

    </div>
  )
}
