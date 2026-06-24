import { prisma } from '@/lib/prisma'
import { avg, fmtCurrency, fmtDate, formatLossReason } from '@/lib/utils'
import { calcHealth, healthColor, healthBg, compareProjectHealth, burnPct, marginSignal } from '@/lib/project-health'
import { startOfDay, subDays, startOfWeek, differenceInDays, format } from 'date-fns'
import Link from 'next/link'
import BlockerActions from './BlockerActions'

export const dynamic = 'force-dynamic'

export default async function IntelligencePage() {
  const today = startOfDay(new Date())
  const thisWeek = startOfWeek(new Date())

  const [projects, members, leads, lossAnalyses, allDailyLogs, allGoals, openBlockers, weeklyScores] =
    await Promise.all([
      prisma.project.findMany({
        include: {
          developer: true,
          milestones: true,
          scopeChanges: true,
          postDeliveryIssues: { select: { id: true } },
          checkIns: { orderBy: { weekOf: 'desc' }, take: 4 },

          postMortem: true,
          dailyTasks: {
            where: { createdAt: { gte: subDays(today, 30) } },
            include: { dailyLog: { include: { member: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }).then(res => res || []),
      prisma.teamMember.findMany({
        where: { active: true },
        include: {
          weeklyScores: { orderBy: { weekOf: 'desc' }, take: 8 },
          goals: { where: { status: 'active' } },
          dailyLogs: {
            where: { date: { gte: subDays(today, 30) } },
            include: { tasks: true },
          },
        },
      }).then(res => res || []),
      prisma.lead.findMany({
        include: { owner: true, lossAnalysis: true, proposals: true },
        orderBy: { createdAt: 'desc' },
      }).then(res => res || []),
      prisma.lossAnalysis.findMany({ include: { lead: { include: { owner: true } } } }).then(res => res || []),
      prisma.dailyLog.findMany({
        where: { date: { gte: subDays(today, 7) } },
        include: { tasks: true, member: true },
      }).then(res => res || []),
      prisma.goal.findMany({ include: { member: true } }).then(res => res || []),
      prisma.blocker.findMany({
        where: { status: { in: ['open', 'in_progress'] } },
        include: { member: true, project: { select: { name: true } } },
        orderBy: { raisedAt: 'asc' },
      }).then(res => res || []),
      prisma.weeklyScore.findMany({
        where: { weekOf: { gte: subDays(thisWeek, 42) } },
        include: { member: true },
        orderBy: { weekOf: 'asc' },
      }).then(res => res || []),
    ])

  const activeProjects = projects.filter(p => ['active', 'qa', 'scoping'].includes(p.status))
  const deliveredProjects = projects.filter(p => p.status === 'delivered')

  // ── Compute project health scores ─────────────────────────────────────────
  const projectHealth = activeProjects.map(p => {
    const h = calcHealth(p)
    const daysLeft = p.estimatedEnd ? differenceInDays(new Date(p.estimatedEnd), new Date()) : null
    const daysTotal = p.startDate && p.estimatedEnd
      ? differenceInDays(new Date(p.estimatedEnd), new Date(p.startDate))
      : null
    const daysElapsed = p.startDate ? differenceInDays(new Date(), new Date(p.startDate)) : 0
    const schedulePct = daysTotal && daysTotal > 0 ? Math.round((daysElapsed / daysTotal) * 100) : null
    const burnPctValue = burnPct(p.estimatedHours, p.actualHours)
    const projectedHours = p.estimatedHours && p.actualHours && daysElapsed > 0 && daysTotal
      ? Math.round((p.actualHours / daysElapsed) * daysTotal)
      : null
    const ci = (p.checkIns || [])[0]
    const lastClientUpdate = (p.checkIns || []).find(c => c.clientUpdated)
    const daysSinceClientUpdate = lastClientUpdate
      ? differenceInDays(new Date(), new Date(lastClientUpdate.weekOf))
      : 99

    // Time by task type
    const taskTypeSummary = (p.dailyTasks || []).reduce((acc, t) => {
      if (t.actualHours) acc[t.taskType] = (acc[t.taskType] || 0) + t.actualHours
      return acc
    }, {} as Record<string, number>)

    return { project: p, health: h, daysLeft, schedulePct, burnPct: burnPctValue, projectedHours, ci, daysSinceClientUpdate, taskTypeSummary }
  })
  .sort((a, b) => compareProjectHealth(a.health, b.health, a.project.name, b.project.name))

  // ── Blocker analysis ──────────────────────────────────────────────────────
  const blockersWithAge = openBlockers.map(b => ({
    ...b,
    ageHours: differenceInDays(new Date(), new Date(b.raisedAt)) * 24,
  }))

  // ── Pipeline loss patterns ────────────────────────────────────────────────
  const closedLeads = leads.filter(l => ['won', 'lost'].includes(l.status))
  const lostLeads = leads.filter(l => l.status === 'lost')
  const winRate = closedLeads.length ? Math.round((leads.filter(l => l.status === 'won').length / closedLeads.length) * 100) : 0

  const lossStageBreakdown = lostLeads.reduce((acc, l) => {
    const lastProposal = (l.proposals || []).sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0]
    const stage = lastProposal?.status || 'no_proposal'
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const lossByReason = lossAnalyses.reduce((acc, la) => {
    acc[la.reason] = (acc[la.reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const lossByFault = lossAnalyses.reduce((acc, la) => {
    acc[la.faultArea] = (acc[la.faultArea] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // ── Productivity / utilisation ────────────────────────────────────────────
  const DAILY_LOGGING_ROLES = ['Dev', 'Both', 'QA']
  const LOW_ACTIVITY_HOURS = 20 // less than 20h logged in last 7 days

  const memberProductivity = members
    .filter(m => DAILY_LOGGING_ROLES.includes(m.role))
    .filter(m => allDailyLogs.some(l => l.memberId === m.id && l.planSubmittedAt))
    .map(m => {
    const logs = allDailyLogs.filter(l => l.memberId === m.id)
    const allTasks = logs.flatMap(l => l.tasks)
    const loggedHours = allTasks.filter(t => t.actualHours).reduce((s, t) => s + (t.actualHours || 0), 0)
    const plannedHours = allTasks.filter(t => t.estimatedHours).reduce((s, t) => s + (t.estimatedHours || 0), 0)
    const billableHours = allTasks.filter(t => t.projectId && t.actualHours).reduce((s, t) => s + (t.actualHours || 0), 0)
    const doneTasks = allTasks.filter(t => t.status === 'done').length
    const totalTasks = allTasks.length
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : null
    const workingDays = 5 // last 7 days = 5 working days approx
    const expectedHours = workingDays * 8
    const utilisation = expectedHours > 0 ? Math.round((loggedHours / expectedHours) * 100) : 0
    const billability = loggedHours > 0 ? Math.round((billableHours / loggedHours) * 100) : 0
    const estAccuracy = (() => {
      const paired = allTasks.filter(t => t.estimatedHours && t.actualHours && t.estimatedHours > 0)
      if (!paired.length) return null
      return Math.round(avg(paired.map(t => (t.actualHours! / t.estimatedHours!) * 100)))
    })()

    // Score trend: last 4 weeks
    const myScores = weeklyScores.filter(s => s.memberId === m.id)
    const recentAvg = myScores.length
      ? avg(myScores.slice(-4).map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
      : null
    const prevAvg = myScores.length >= 8
      ? avg(myScores.slice(-8, -4).map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
      : null
    const scoreTrend = recentAvg && prevAvg ? recentAvg - prevAvg : null

    return {
      member: m,
      loggedHours, plannedHours, billableHours, utilisation, billability,
      completionRate, estAccuracy, recentAvg, scoreTrend,
      idle: loggedHours < LOW_ACTIVITY_HOURS,
      goals: m.goals,
    }
  })
  .sort((a, b) => {
    if (a.idle !== b.idle) return a.idle ? -1 : 1
    if (a.utilisation !== b.utilisation) return a.utilisation - b.utilisation
    return a.member.name.localeCompare(b.member.name)
  })

  // Weekly score stats for all members (used by People vs goals — not limited to daily-logging roles)
  const memberScoreStats = new Map(members.map(m => {
    const myScores = weeklyScores.filter(s => s.memberId === m.id)
    const recentAvg = myScores.length
      ? avg(myScores.slice(-4).map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
      : null
    const prevAvg = myScores.length >= 8
      ? avg(myScores.slice(-8, -4).map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
      : null
    const scoreTrend = recentAvg != null && prevAvg != null ? recentAvg - prevAvg : null
    return [m.id, { recentAvg, scoreTrend }] as const
  }))

  // ── Time in lifecycle by phase ────────────────────────────────────────────
  const phaseTime = projects.flatMap(p => p.dailyTasks || []).reduce((acc, t) => {
    if (t.actualHours) acc[t.taskType] = (acc[t.taskType] || 0) + t.actualHours
    return acc
  }, {} as Record<string, number>)
  const totalPhaseHours = (Object.values(phaseTime) as number[]).reduce((a, b) => a + b, 0)

  // ── Estimation accuracy across all delivered projects ─────────────────────
  const deliveredWithData = deliveredProjects.filter(p => p.estimatedHours && p.actualHours)
  const avgEstAccuracy = deliveredWithData.length
    ? Math.round(avg(deliveredWithData.map(p => (p.actualHours! / p.estimatedHours!) * 100)))
    : null
  const onTimeRate = deliveredWithData.length
    ? Math.round((deliveredWithData.filter(p => p.onTime).length / deliveredWithData.length) * 100)
    : null

  const scoreCol = (v: number) => v >= 8 ? 'text-green-700' : v >= 6 ? 'text-amber-700' : 'text-red-600'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Founder Intelligence</h1>
          <p className="text-sm text-gray-500 mt-0.5">Everything you need to see the real state of the business. Refresh at any time.</p>
        </div>
        <div className="text-xs text-gray-400">{format(new Date(), "EEEE, d MMM yyyy · HH:mm")}</div>
      </div>

      {/* ── SECTION 1: PROJECT HEALTH ──────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            1 · Project health — {activeProjects.length} active
          </h2>
          <Link href="/projects" className="text-xs text-gray-400 hover:text-gray-600">All projects →</Link>
        </div>
        <p className="text-xs text-gray-400 mb-3 flex flex-wrap gap-x-4 gap-y-1">
          <span>Sorted lowest score first</span>
          <span className="text-red-600">≤5 critical</span>
          <span className="text-amber-700">5.1–7.4 at risk</span>
          <span className="text-green-700">≥7.5 healthy</span>
        </p>

        <div className="space-y-3">
          {projectHealth.map(({ project: p, health, daysLeft, schedulePct, burnPct, projectedHours, ci, daysSinceClientUpdate, taskTypeSummary }) => {
            const milestonesDone = (p.milestones || []).filter(m => m.status === 'done').length
            const milestonesTotal = (p.milestones || []).length
            // const openCrit = p?.bugs?.filter(b => b.severity === 'critical' && ['open','in_progress'].includes(b.status))?.length || 0
            const unsignedCOs = (p.scopeChanges || []).filter(s => !s.changeOrderSigned).length

            return (
              <div key={p.id} className={`card p-4 border ${healthBg(health.label)}`}>
                <div className="flex items-start gap-4">
                  {/* Health score */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold ${
                    health.label === 'healthy' ? 'bg-green-100' : health.label === 'at_risk' ? 'bg-amber-100' : 'bg-red-100'
                  }`}>
                    <span className={`text-xl ${healthColor(health.label)}`}>{health.score}</span>
                    <span className={`text-xs ${healthColor(health.label)}`}>/10</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <Link href={`/projects/${p.id}`} className="text-base font-semibold text-gray-900 hover:underline">{p.name}</Link>
                      <span className={`badge text-xs font-medium ${
                        health.label === 'healthy' ? 'bg-green-100 text-green-800' :
                        health.label === 'at_risk' ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>{health.label.replace('_',' ')}</span>
                      {unsignedCOs > 0 && <span className="badge bg-red-100 text-red-800 text-xs">{unsignedCOs} CO unsigned</span>}
                      {daysSinceClientUpdate > 7 && <span className="badge bg-amber-100 text-amber-800 text-xs">{daysSinceClientUpdate}d no client update</span>}
                    </div>

                    {/* Progress bars */}
                    <div className="grid grid-cols-3 gap-4 text-xs mb-2">
                      <div>
                        <div className="flex justify-between text-gray-500 mb-1">
                          <span>Timeline</span>
                          <span>{daysLeft != null ? (daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`) : '—'}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${schedulePct != null && schedulePct > 100 ? 'bg-red-500' : 'bg-blue-400'}`}
                            style={{ width: `${Math.min(schedulePct ?? 0, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-gray-500 mb-1">
                          <span>Hours burned</span>
                          <span className={burnPct && burnPct > 120 ? 'text-red-600 font-medium' : ''}>
                            {burnPct != null ? `${burnPct}%` : '—'}
                            {projectedHours && p.estimatedHours && projectedHours > p.estimatedHours
                              ? ` · proj. ${projectedHours}h` : ''}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${burnPct && burnPct > 120 ? 'bg-red-500' : burnPct && burnPct > 100 ? 'bg-amber-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(burnPct ?? 0, 100)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-gray-500 mb-1">
                          <span>Milestones</span>
                          <span>{milestonesTotal > 0 ? `${milestonesDone}/${milestonesTotal}` : '—'}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-400"
                            style={{ width: `${milestonesTotal > 0 ? (milestonesDone / milestonesTotal) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Blocker + phase time mini row */}
                    <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
                      <span>Owner: {p.developer.name}</span>
                      {p.contractValue && <span>Value: {fmtCurrency(p.contractValue, p.currency)}</span>}
                      {ci?.blockers && <span className="text-amber-700 font-medium">⚠ {ci.blockers.slice(0, 60)}{ci.blockers.length > 60 ? '…' : ''}</span>}
                      {/* Mini task type breakdown */}
                      {Object.keys(taskTypeSummary).length > 0 && (
                        <span className="text-gray-400">
                          Time: {(Object.entries(taskTypeSummary) as [string, number][]).sort((a,b) => b[1]-a[1]).slice(0,3)
                            .map(([t,h]) => `${t} ${h.toFixed(0)}h`).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {activeProjects.length === 0 && (
            <div className="card p-8 text-center text-gray-400 text-sm">No active projects.</div>
          )}
        </div>
      </div>

      {/* ── SECTION 2: OPEN BLOCKERS ───────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            2 · Open blockers — {openBlockers.length} unresolved
          </h2>
          <Link href="/intelligence/blockers" className="text-xs text-gray-400 hover:text-gray-600">All blockers →</Link>
        </div>

        {openBlockers.length === 0 ? (
          <div className="card p-4 text-sm text-green-700 font-medium bg-green-50 border border-green-100">
            ✓ No open blockers right now.
          </div>
        ) : (
          <div className="space-y-2">
            {blockersWithAge.map(b => {
              const ageDays = Math.floor(b.ageHours / 24)
              const urgent = ageDays >= 2
              return (
                <div key={b.id} className={`card p-4 flex items-start gap-4 border ${urgent ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                  <div className={`flex-shrink-0 text-center min-w-12`}>
                    <div className={`text-xl font-bold ${urgent ? 'text-red-600' : 'text-amber-700'}`}>{ageDays}d</div>
                    <div className="text-xs text-gray-400">open</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{b.member.name}</span>
                      {b.project && <span className="text-xs text-gray-500">{b.project.name}</span>}
                      <span className={`badge text-xs ${urgent ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        {b.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{b.description}</p>
                    <div className="text-xs text-gray-400 mt-1">{b.category.replace(/_/g,' ')} · raised {fmtDate(b.raisedAt)}</div>
                  </div>
                  <BlockerActions blocker={{ id: b.id, status: b.status }} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* ── SECTION 3: TEAM PERFORMANCE vs GOALS ──────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">3 · People vs goals</h2>
            <Link href="/goals" className="text-xs text-gray-400 hover:text-gray-600">Manage goals →</Link>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-2 font-medium">Member</th>
                  <th className="text-center px-3 py-2 font-medium">Score</th>
                  <th className="text-center px-3 py-2 font-medium">Trend</th>
                  <th className="text-left px-3 py-2 font-medium">Active goals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.map(m => {
                  const { recentAvg, scoreTrend } = memberScoreStats.get(m.id) ?? { recentAvg: null, scoreTrend: null }
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{m.name}</div>
                        <div className="text-xs text-gray-400">{m.role}</div>
                      </td>
                      <td className={`text-center px-3 py-2.5 font-semibold ${recentAvg != null ? scoreCol(recentAvg) : 'text-gray-300'}`}>
                        {recentAvg != null ? recentAvg.toFixed(1) : '—'}
                      </td>
                      <td className="text-center px-3 py-2.5 text-xs">
                        {scoreTrend != null
                          ? <span className={scoreTrend > 0 ? 'text-green-600' : scoreTrend < 0 ? 'text-red-500' : 'text-gray-400'}>
                              {scoreTrend > 0 ? `▲ +${scoreTrend.toFixed(1)}` : scoreTrend < 0 ? `▼ ${scoreTrend.toFixed(1)}` : '→'}
                            </span>
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {(m.goals || []).length === 0
                          ? <span className="text-xs text-gray-300">No goals set</span>
                          : <div className="space-y-1">
                              {(m.goals || []).slice(0,2).map(g => (
                                <div key={g.id} className="flex items-center gap-2">
                                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden max-w-16">
                                    <div className={`h-full rounded-full ${g.progressPct >= 80 ? 'bg-green-400' : g.progressPct >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`}
                                      style={{ width: `${g.progressPct}%` }} />
                                  </div>
                                  <span className="text-xs text-gray-500 truncate max-w-24">{g.title}</span>
                                </div>
                              ))}
                            </div>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECTION 5: PIPELINE LOSS PATTERNS ─────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">5 · Why we lose leads</h2>
            <Link href="/pipeline?status=lost" className="text-xs text-gray-400 hover:text-gray-600">All losses →</Link>
          </div>
          <div className="card p-4">
            <div className="flex gap-6 text-sm mb-4">
              <div><span className="text-2xl font-bold text-gray-900">{winRate}%</span><div className="text-xs text-gray-400">Win rate</div></div>
              <div><span className="text-2xl font-bold text-gray-900">{lostLeads.length}</span><div className="text-xs text-gray-400">Lost total</div></div>
              <div><span className="text-2xl font-bold text-red-600">{lossAnalyses.filter(l => !l.lead).length + (lostLeads.length - lossAnalyses.length > 0 ? lostLeads.length - lossAnalyses.length : 0)}</span><div className="text-xs text-gray-400">No analysis logged</div></div>
            </div>

            {lossAnalyses.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Lost at stage</div>
                  {(Object.entries(lossStageBreakdown) as [string,number][]).sort((a,b)=>b[1]-a[1]).map(([stage, count]) => (
                    <div key={stage} className="flex items-center gap-2 mb-1 text-xs">
                      <div className="w-20 text-gray-600 capitalize">{stage.replace(/_/g,' ')}</div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(count/lostLeads.length)*100}%` }} />
                      </div>
                      <span className="text-gray-500 w-4">{count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Reason</div>
                  {(Object.entries(lossByReason) as [string,number][]).sort((a,b)=>b[1]-a[1]).map(([reason, count]) => (
                    <div key={reason} className="flex items-center gap-2 mb-1 text-xs">
                      <div className="w-24 text-gray-600 truncate" title={formatLossReason(reason)}>{formatLossReason(reason)}</div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(count/lossAnalyses.length)*100}%` }} />
                      </div>
                      <span className="text-gray-500 w-4">{count}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Root cause</div>
                  {(Object.entries(lossByFault) as [string,number][]).sort((a,b)=>b[1]-a[1]).map(([fault, count]) => (
                    <div key={fault} className="flex items-center gap-2 mb-1 text-xs">
                      <div className="w-24 text-gray-600 capitalize">{fault}</div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(count/lossAnalyses.length)*100}%` }} />
                      </div>
                      <span className="text-gray-500 w-4">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-amber-700">No loss analyses recorded yet. Add them in Pipeline → Lead detail.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 6+7: TIME IN LIFECYCLE + ESTIMATION ACCURACY ─────────── */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">6 · Where time goes</h2>
          <div className="card p-4">
            <p className="text-xs text-gray-400 mb-3">All hours logged across all projects, last 30 days</p>
            {totalPhaseHours === 0 ? (
              <p className="text-sm text-gray-400">No hours logged yet.</p>
            ) : (
              <div className="space-y-3">
                {(Object.entries(phaseTime) as [string,number][])
                  .sort((a,b) => b[1]-a[1])
                  .map(([type, hours]) => {
                    const pct = Math.round((hours / totalPhaseHours) * 100)
                    const typeColors: Record<string,string> = {
                      feature:'bg-blue-500', bug:'bg-red-500', review:'bg-purple-500',
                      meeting:'bg-gray-400', admin:'bg-gray-300', qa:'bg-teal-500', research:'bg-amber-500'
                    }
                    return (
                      <div key={type}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-700 capitalize">{type}</span>
                          <span className="text-gray-500">{hours.toFixed(1)}h · {pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${typeColors[type] ?? 'bg-gray-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">7 · Estimation accuracy</h2>
          <div className="card p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${avgEstAccuracy == null ? 'text-gray-300' : avgEstAccuracy <= 115 ? 'text-green-700' : avgEstAccuracy <= 140 ? 'text-amber-700' : 'text-red-600'}`}>
                  {avgEstAccuracy != null ? `${avgEstAccuracy}%` : '—'}
                </div>
                <div className="text-xs text-gray-400">Avg actual/estimated</div>
                <div className="text-xs text-gray-300 mt-0.5">Target: ≤115%</div>
              </div>
              <div className="text-center">
                <div className={`text-3xl font-bold ${onTimeRate == null ? 'text-gray-300' : onTimeRate >= 80 ? 'text-green-700' : onTimeRate >= 60 ? 'text-amber-700' : 'text-red-600'}`}>
                  {onTimeRate != null ? `${onTimeRate}%` : '—'}
                </div>
                <div className="text-xs text-gray-400">On-time delivery</div>
                <div className="text-xs text-gray-300 mt-0.5">Target: ≥80%</div>
              </div>
            </div>
            {deliveredWithData.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">By project</div>
                {deliveredWithData.slice(0,5).map(p => {
                  const acc = Math.round((p.actualHours! / p.estimatedHours!) * 100)
                  return (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600 flex-1 truncate">{p.name}</span>
                      <span className={`font-medium ${acc <= 115 ? 'text-green-700' : acc <= 140 ? 'text-amber-700' : 'text-red-600'}`}>{acc}%</span>
                      <span className={p.onTime ? 'text-green-500' : 'text-red-400'}>{p.onTime ? '✓' : '✗'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 8: PRODUCTIVITY / UTILISATION ─────────────────────────── */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">8 · Team productivity — last 7 days</h2>
          <Link href="/daily/analytics" className="text-xs text-gray-400 hover:text-gray-600">Full analytics →</Link>
        </div>
        <p className="text-xs text-gray-400 mb-3 flex flex-wrap gap-x-4 gap-y-1">
          <span>Dev / QA roles · sorted lowest utilisation first</span>
          <span className="text-red-600">&lt;20h logged = Low activity</span>
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Member</th>
                <th className="text-center px-3 py-2.5 font-medium">Logged hrs</th>
                <th className="text-center px-3 py-2.5 font-medium">Utilisation</th>
                <th className="text-center px-3 py-2.5 font-medium">Billable %</th>
                <th className="text-center px-3 py-2.5 font-medium">Task done %</th>
                <th className="text-center px-3 py-2.5 font-medium">Est. accuracy</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {memberProductivity.map(({ member: m, loggedHours, utilisation, billability, completionRate, estAccuracy, idle }) => (
                <tr key={m.id} className={`hover:bg-gray-50 ${idle ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.role}</div>
                  </td>
                  <td className={`text-center px-3 py-2.5 font-semibold ${loggedHours < LOW_ACTIVITY_HOURS ? 'text-red-600' : loggedHours < 30 ? 'text-amber-700' : 'text-green-700'}`}>
                    {loggedHours.toFixed(1)}h
                  </td>
                  <td className="text-center px-3 py-2.5">
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${utilisation >= 80 ? 'bg-green-500' : utilisation >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${Math.min(utilisation, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${utilisation >= 80 ? 'text-green-700' : utilisation >= 60 ? 'text-amber-700' : 'text-red-600'}`}>
                        {utilisation}%
                      </span>
                    </div>
                  </td>
                  <td className={`text-center px-3 py-2.5 text-xs font-medium ${billability >= 70 ? 'text-green-700' : billability >= 50 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {loggedHours > 0 ? `${billability}%` : '—'}
                  </td>
                  <td className={`text-center px-3 py-2.5 text-xs font-medium ${completionRate == null ? 'text-gray-300' : completionRate >= 80 ? 'text-green-700' : completionRate >= 60 ? 'text-amber-700' : 'text-red-600'}`}>
                    {completionRate != null ? `${completionRate}%` : '—'}
                  </td>
                  <td className={`text-center px-3 py-2.5 text-xs font-medium ${estAccuracy == null ? 'text-gray-300' : estAccuracy <= 115 ? 'text-green-700' : estAccuracy <= 140 ? 'text-amber-700' : 'text-red-600'}`}>
                    {estAccuracy != null ? `${estAccuracy}%` : '—'}
                  </td>
                  <td className="text-center px-3 py-2.5">
                    {idle
                      ? <span className="badge bg-red-100 text-red-800 text-xs">⚠ Low activity</span>
                      : utilisation >= 80
                      ? <span className="badge bg-green-100 text-green-800 text-xs">Active</span>
                      : <span className="badge bg-amber-100 text-amber-800 text-xs">Below target</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex gap-6">
            <span>Target utilisation: 80%+ of 40h week</span>
            <span>Billable target: 70%+ of logged hours</span>
            <span>Est. accuracy target: ≤115% (actual/estimated)</span>
          </div>
        </div>
      </div>

      {/* ── BONUS: MARGIN HEALTH PER PROJECT ──────────────────────────────── */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">+ Margin health — are we profitable right now?</h2>
        <p className="text-xs text-gray-400 mb-3 flex flex-wrap gap-x-4 gap-y-1">
          <span>Actual hours vs estimate</span>
          <span className="text-red-600">&gt;100% burned = Over budget</span>
          <span className="text-amber-700">86–100% = Watch</span>
          <span className="text-green-700">≤85% = On budget</span>
        </p>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5 font-medium">Project</th>
                <th className="text-center px-3 py-2.5 font-medium">Contract</th>
                <th className="text-center px-3 py-2.5 font-medium">Est. hours</th>
                <th className="text-center px-3 py-2.5 font-medium">Burned</th>
                <th className="text-center px-3 py-2.5 font-medium">Rate/hr</th>
                <th className="text-center px-3 py-2.5 font-medium">Projected cost</th>
                <th className="text-center px-3 py-2.5 font-medium">Margin signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activeProjects.filter(p => p.contractValue && p.estimatedHours).map(p => {
                const ratePerHr = p.contractValue! / p.estimatedHours!
                const projectedCost = p.actualHours ? (p.actualHours / (p.estimatedHours! * 0.7)) * p.contractValue! : null
                const pct = burnPct(p.estimatedHours, p.actualHours)
                const signal = marginSignal(p.estimatedHours, p.actualHours, projectedCost, p.contractValue)

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{p.name}</td>
                    <td className="text-center px-3 py-2.5">{fmtCurrency(p.contractValue, p.currency)}</td>
                    <td className="text-center px-3 py-2.5 text-gray-500">{p.estimatedHours}h</td>
                    <td className={`text-center px-3 py-2.5 font-medium ${pct != null && pct > 100 ? 'text-red-600' : pct != null && pct > 85 ? 'text-amber-700' : 'text-gray-700'}`}>
                      {p.actualHours != null ? `${p.actualHours}h` : '—'}
                      {pct != null && pct > 100 && (
                        <span className="block text-xs text-red-500">{pct}% of estimate</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-500">
                      {ratePerHr ? `${fmtCurrency(ratePerHr)}/h` : '—'}
                    </td>
                    <td className={`text-center px-3 py-2.5 font-medium ${projectedCost && projectedCost > p.contractValue! ? 'text-red-600' : 'text-green-700'}`}>
                      {projectedCost ? fmtCurrency(projectedCost, p.currency) : '—'}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {signal === 'no_data' ? <span className="text-gray-300 text-xs">No data</span>
                        : signal === 'over_budget' ? <span className="badge bg-red-100 text-red-800 text-xs">Over budget</span>
                        : signal === 'watch' ? <span className="badge bg-amber-100 text-amber-800 text-xs">Watch</span>
                        : <span className="badge bg-green-100 text-green-800 text-xs">On budget</span>}
                    </td>
                  </tr>
                )
              })}
              {activeProjects.filter(p => p.contractValue && p.estimatedHours).length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400 text-sm">Add contract value and estimated hours to projects to see margin health.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
