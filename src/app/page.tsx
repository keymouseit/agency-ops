import { prisma } from '@/lib/prisma'
import { fmtCurrency, scoreColor, avg } from '@/lib/utils'
import Link from 'next/link'
import { startOfWeek, subWeeks, startOfDay, format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const [leads, projects, scores, members, dailyLogs, allQAIssues] = await Promise.all([
    prisma.lead.findMany({ include: { owner: true } }),
    prisma.project.findMany({ include: { developer: true, checkIns: { orderBy: { weekOf: 'desc' }, take: 1 }, scopeChanges: true, releaseSignOff: true, postDeliveryIssues: { where: { resolvedAt: null }, take: 1 } } }),
    prisma.weeklyScore.findMany({
      where: { weekOf: { gte: subWeeks(startOfWeek(new Date()), 0) } },
      include: { member: true },
    }),
    prisma.teamMember.findMany({ where: { active: true } }),
    prisma.dailyLog.findMany({
      where: { date: startOfDay(new Date()) },
      include: {
        member: true,
        tasks: true,
      },
    }),
    prisma.postDeliveryIssue.findMany({
      select: { id: true, severity: true, wasInScope: true, resolvedAt: true },
    }),
  ])

  const totalPipeline = leads.filter(l => !['won','lost'].includes(l.status)).reduce((s, l) => s + (l.budget || 0), 0)
  const wonRevenue = leads.filter(l => l.status === 'won').reduce((s, l) => s + (l.budget || 0), 0)
  const winRate = leads.length ? Math.round((leads.filter(l => l.status === 'won').length / leads.filter(l => ['won','lost'].includes(l.status)).length) * 100) : 0
  const activeProjects = projects.filter(p => ['active','qa','scoping'].includes(p.status))
  const atRisk = projects.filter(p => {
    const last = p.checkIns[0]
    return last && (last.onTrack === 'no' || last.onTrack === 'at_risk')
  })
  const unsignedScope = projects.flatMap(p => p.scopeChanges.filter(s => !s.changeOrderSigned))
  const avgTeamScore = scores.length
    ? avg(scores.map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
    : 0

  // QA miss metrics
  const qaMissCount = allQAIssues.filter(i => i.wasInScope === true).length
  const unresolvedQAMisses = allQAIssues.filter(i => i.wasInScope === true && !i.resolvedAt).length

  const projectsWithClientIssues = projects.filter(p => (p.postDeliveryIssues ?? []).length > 0)
  const projectsNeedingQASignOff = projects.filter(p =>
    p.status === 'qa' && !p.releaseSignOff
  )

  const recentFlags = [
    ...projectsWithClientIssues.map(p => ({ project: p.name, flag: 'Client reported an issue post-delivery', type: 'red' as const })),
    ...projectsNeedingQASignOff.map(p => ({ project: p.name, flag: 'Status is QA but no sign-off submitted', type: 'amber' as const })),
    ...projects.flatMap(p => {
      const ci = p.checkIns[0]
      if (!ci) return []
      const flags: { project: string; flag: string; type: string }[] = []
      if (ci.onTrack === 'no') flags.push({ project: p.name, flag: 'Delivery at risk — overdue', type: 'red' })
      if (ci.scopeChange === 'unlogged') flags.push({ project: p.name, flag: 'Scope change logged without CO', type: 'amber' })
      if (!ci.clientUpdated) flags.push({ project: p.name, flag: 'No client update this week', type: 'amber' })
      try {
        const f = JSON.parse(ci.flags || '[]') as string[]
        f.forEach(fl => flags.push({ project: p.name, flag: fl, type: 'amber' }))
      } catch {}
      return flags
    }),
  ].slice(0, 6)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Good morning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Here's everything that needs your attention today.</p>
        </div>
        <div className="text-xs text-gray-400">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Active pipeline', value: fmtCurrency(totalPipeline), sub: `${leads.filter(l => !['won','lost'].includes(l.status)).length} open leads`, danger: false },
          { label: 'Won revenue (total)', value: fmtCurrency(wonRevenue), sub: `${winRate}% win rate`, danger: false },
          { label: 'Active projects', value: activeProjects.length.toString(), sub: `${atRisk.length} at risk`, danger: false },
          { label: 'Avg team score', value: avgTeamScore.toFixed(1), sub: `This week · out of 10`, danger: false },
          { label: 'QA miss (total)', value: qaMissCount.toString(), sub: `${unresolvedQAMisses} unresolved`, danger: unresolvedQAMisses > 0, link: '/qa' },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.danger ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.sub}</div>
            {k.link && (
              <Link href={k.link} className="text-xs text-blue-600 hover:underline mt-1 block">View details →</Link>
            )}
          </div>
        ))}
      </div>

      {/* Daily ops summary */}
      {(() => {
        const today = new Date()
        const isWeekday = today.getDay() !== 0 && today.getDay() !== 6
        if (!isWeekday) return null
        const submitted = dailyLogs.filter(l => l.planSubmittedAt).length
        const eodDone = dailyLogs.filter(l => l.eodSubmittedAt).length
        const noPlan = members.filter(m => !dailyLogs.find(l => l.memberId === m.id && l.planSubmittedAt))
        const blockers = dailyLogs.filter(l => l.blockers && l.blockers.trim())
        const allTasks = dailyLogs.flatMap(l => l.tasks)
        const doneTasks = allTasks.filter(t => t.status === 'done').length
        return (
          <div className="card p-4 mb-6 border-l-4 border-blue-400">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">Today — {format(today, 'EEEE d MMM')}</span>
                <span className="badge bg-blue-100 text-blue-800 text-xs">{submitted}/{members.length} planned · {eodDone} EOD done</span>
              </div>
              <Link href="/daily" className="text-xs text-blue-600 hover:underline">Full daily view →</Link>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs uppercase tracking-wide">Tasks</span>
                <div className="font-semibold text-gray-800">{doneTasks} done / {allTasks.length} planned</div>
              </div>
              {noPlan.length > 0 && (
                <div>
                  <span className="text-red-500 text-xs uppercase tracking-wide">No plan submitted</span>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {noPlan.map(m => (
                      <span key={m.id} className="badge bg-red-100 text-red-700 text-xs">{m.name.split(' ')[0]}</span>
                    ))}
                  </div>
                </div>
              )}
              {blockers.length > 0 && (
                <div>
                  <span className="text-amber-600 text-xs uppercase tracking-wide">Blockers today</span>
                  <div className="text-gray-700 text-sm">{blockers.map(l => l.member.name.split(' ')[0]).join(', ')}</div>
                </div>
              )}
              {submitted === members.length && noPlan.length === 0 && (
                <div className="text-green-700 text-sm font-medium">✓ Full team planned</div>
              )}
            </div>
          </div>
        )
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Flags */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Flags requiring attention</h2>
          {recentFlags.length === 0 && <p className="text-sm text-gray-400">No flags this week. Good.</p>}
          <div className="space-y-2">
            {recentFlags.map((f, i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-lg text-sm ${f.type === 'red' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100'}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${f.type === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <div>
                  <div className={`font-medium ${f.type === 'red' ? 'text-red-800' : 'text-amber-800'}`}>{f.flag}</div>
                  <div className={`text-xs mt-0.5 ${f.type === 'red' ? 'text-red-600' : 'text-amber-600'}`}>{f.project}</div>
                </div>
              </div>
            ))}
          </div>
          {unsignedScope.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100 text-sm">
              <div className="font-medium text-red-800">{unsignedScope.length} scope change(s) without signed change order</div>
              <Link href="/projects" className="text-xs text-red-600 underline mt-0.5 block">Review in Projects →</Link>
            </div>
          )}
        </div>

        {/* Project health */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Project health</h2>
          <div className="space-y-3">
            {activeProjects.map(p => {
              const ci = p.checkIns[0]
              const pct = ci?.progressPct ?? 0
              const status = ci?.onTrack ?? 'yes'
              const barColor = status === 'yes' ? 'bg-green-500' : status === 'at_risk' ? 'bg-amber-400' : 'bg-red-500'
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span className={`text-xs ${status === 'yes' ? 'text-green-700' : status === 'at_risk' ? 'text-amber-700' : 'text-red-700'}`}>
                      {status === 'yes' ? 'On track' : status === 'at_risk' ? 'At risk' : 'Late'} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{p.developer.name}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Team scores this week */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Team scores — this week</h2>
          {scores.length === 0 ? (
            <p className="text-sm text-gray-400">No check-ins submitted yet this week.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left pb-2 font-medium">Member</th>
                  <th className="text-center pb-2 font-medium">Del</th>
                  <th className="text-center pb-2 font-medium">Proc</th>
                  <th className="text-center pb-2 font-medium">Comm</th>
                  <th className="text-center pb-2 font-medium">Grw</th>
                  <th className="text-center pb-2 font-medium">Cult</th>
                  <th className="text-center pb-2 font-medium">Avg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {scores.map(s => {
                  const overall = avg([s.delivery, s.process, s.communication, s.growth, s.culture])
                  return (
                    <tr key={s.id}>
                      <td className="py-1.5 font-medium text-gray-800">{s.member.name.split(' ')[0]}</td>
                      {[s.delivery, s.process, s.communication, s.growth, s.culture].map((v, i) => (
                        <td key={i} className={`text-center py-1.5 font-semibold ${scoreColor(v)}`}>{v}</td>
                      ))}
                      <td className={`text-center py-1.5 font-bold ${scoreColor(overall)}`}>{overall}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <Link href="/team" className="text-xs text-gray-400 hover:text-gray-600 mt-3 block">View trends & history →</Link>
        </div>

        {/* Recent lost leads */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent losses — root causes</h2>
          {leads.filter(l => l.status === 'lost').length === 0
            ? <p className="text-sm text-gray-400">No lost leads recorded yet.</p>
            : (
              <div className="space-y-2">
                {leads.filter(l => l.status === 'lost').slice(0, 4).map(l => (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{l.clientName}</div>
                      <div className="text-xs text-gray-400">{fmtCurrency(l.budget, l.currency)} · {l.owner.name}</div>
                    </div>
                    <Link href={`/pipeline/${l.id}`} className="text-xs text-gray-400 hover:text-gray-700 underline">Analysis →</Link>
                  </div>
                ))}
              </div>
            )
          }
          <Link href="/pipeline?status=lost" className="text-xs text-gray-400 hover:text-gray-600 mt-3 block">View all losses →</Link>
        </div>
      </div>
    </div>
  )
}
