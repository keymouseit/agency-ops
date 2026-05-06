import { prisma } from '@/lib/prisma'
import { avg, fmtCurrency } from '@/lib/utils'
import { startOfWeek, subWeeks } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const [leads, projects, scores, members, lossAnalyses] = await Promise.all([
    prisma.lead.findMany({ include: { owner: true, lossAnalysis: true } }),
    prisma.project.findMany({ include: { owner: true, scopeChanges: true, postMortem: true } }),
    prisma.weeklyScore.findMany({
      where: { weekOf: { gte: subWeeks(startOfWeek(new Date()), 7) } },
      include: { member: true },
      orderBy: { weekOf: 'asc' },
    }),
    prisma.teamMember.findMany({ where: { active: true } }),
    prisma.lossAnalysis.findMany({ include: { lead: { include: { owner: true } } } }),
  ])

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
      <p className="text-sm text-gray-500 mb-8">The numbers that tell you where the business is actually healthy — and where it isn't.</p>

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
                      <div className="text-xs text-gray-600 w-36">{reason.replace(/_/g, ' ')}</div>
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
                  <th key={i} className="text-center pb-2 font-medium">{w.week.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</th>
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
                      <td className="py-2 text-gray-500">{p.owner.name}</td>
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
  )
}
