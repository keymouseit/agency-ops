import Link from 'next/link'
import { startOfWeek, subDays, differenceInDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { avg, isSameWeek } from '@/lib/utils'
import { businessDayStart } from '@/lib/daily'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import { latestCycleProgress, projectMilestoneProgress } from '@/lib/qa-dashboard'
import { calculateMilestoneProgress } from '@/lib/milestone-qa'
import { isBlockingCycleResult, testCycleCaseSummary } from '@/lib/qa'
import { assignedToMemberWhere } from '@/lib/project-assignees'
import { milestoneListOrderBy } from '@/lib/project-queries'
import MeSection from './MeSection'

type Props = {
  memberId: string
  role: string
  hasCheckin: boolean
}

/** Secondary /me column — streams independently of the primary plan column. */
export default async function MeRightRail({ memberId, role, hasCheckin }: Props) {
  const today = businessDayStart()
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isDev = role === 'Dev' || role === 'Both'
  const isBD = role === 'BD' || role === 'Both'
  const isQA = role === 'QA'

  const [myProjects, myLeads, myOpenBlockers, myGoals, thisWeekScore, recentScores, qaProjects] =
    await Promise.all([
      isDev
        ? prisma.project.findMany({
            where: { AND: [assignedToMemberWhere(memberId), { status: { in: ['scoping', 'active', 'qa'] } }] },
            select: {
              id: true,
              name: true,
              status: true,
              milestones: {
                select: { status: true, title: true, dueDate: true },
                orderBy: milestoneListOrderBy,
              },
              checkIns: {
                orderBy: { weekOf: 'desc' },
                take: 1,
                select: { onTrack: true, blockers: true, weekOf: true },
              },
              releaseSignOff: { select: { id: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
      isBD
        ? prisma.lead.findMany({
            where: { ownerId: memberId, status: { in: ['new', 'proposal_sent', 'interview'] } },
            orderBy: { updatedAt: 'asc' },
            take: 8,
            select: {
              id: true,
              clientName: true,
              status: true,
              budget: true,
              currency: true,
              updatedAt: true,
              createdAt: true,
              proposals: { orderBy: { sentAt: 'desc' }, take: 1, select: { sentAt: true } },
            },
          })
        : Promise.resolve([]),
      isDev || isQA
        ? prisma.blocker.findMany({
            where: { memberId, status: { in: ['open', 'in_progress'] } },
            include: { project: { select: { name: true } } },
            orderBy: { raisedAt: 'asc' },
          })
        : Promise.resolve([]),
      prisma.goal.findMany({
        where: { memberId, status: { in: ['active', 'achieved', 'missed'] } },
        orderBy: [{ quarter: 'desc' }, { updatedAt: 'desc' }],
      }),
      prisma.weeklyScore.findFirst({
        where: { memberId, weekOf: thisWeek, founderScore: false },
      }),
      prisma.weeklyScore.findMany({
        where: { memberId, founderScore: false, weekOf: { gte: subDays(thisWeek, 56) } },
        orderBy: { weekOf: 'asc' },
      }),
      isQA
        ? prisma.project.findMany({
            where: { status: { in: ['active', 'qa'] } },
            include: {
              milestones: {
                orderBy: milestoneListOrderBy,
                include: { testCases: { select: { status: true } } },
              },
              testCycles: {
                orderBy: { startedAt: 'desc' },
                take: 1,
                include: { cases: { select: { status: true, devFixedAt: true } } },
              },
              releaseSignOff: true,
              postDeliveryIssues: { where: { resolvedAt: null }, take: 1 },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

  const scoreAvg =
    recentScores.length >= 4
      ? avg(
          recentScores
            .slice(-4)
            .map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])),
        )
      : null
  const prevAvg =
    recentScores.length >= 8
      ? avg(
          recentScores
            .slice(-8, -4)
            .map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])),
        )
      : null
  const scoreTrend = scoreAvg && prevAvg ? scoreAvg - prevAvg : null

  const goalStatusOrder: Record<string, number> = { active: 0, achieved: 1, missed: 2 }
  const sortedGoals = [...myGoals].sort(
    (a, b) =>
      (goalStatusOrder[a.status] ?? 9) - (goalStatusOrder[b.status] ?? 9) ||
      a.progressPct - b.progressPct,
  )
  const activeGoals = sortedGoals.filter(g => g.status === 'active')
  const closedGoals = sortedGoals.filter(g => g.status !== 'active')
  const checkinDone = hasCheckin || !!thisWeekScore

  return (
    <>
      {isDev && myProjects.length > 0 && (
        <MeSection title="Your projects" icon="🚀" actionHref="/projects" actionLabel="All →">
          <div className="space-y-3">
            {myProjects.slice(0, 3).map(p => {
              const ci = p.checkIns[0]
              const totalMilestones = p.milestones.length
              const completedMilestones = p.milestones.filter(m => m.status === 'done').length
              const calculatedProgress =
                totalMilestones > 0 ? calculateMilestoneProgress(p.milestones) : null
              const milestone = p.milestones.find(m => m.status !== 'done')
              const daysLeft = milestone?.dueDate
                ? differenceInDays(new Date(milestone.dueDate), today)
                : null
              const isLate = daysLeft !== null && daysLeft < 0
              const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
              const isMonday = today.getDay() === 1
              const projectCheckinThisWeek = ci ? isSameWeek(ci.weekOf, today) : false
              const projectCheckinOverdue = ci
                ? differenceInDays(today, new Date(ci.weekOf)) > 7
                : true
              const needsCheckin =
                !checkinDone && !projectCheckinThisWeek && (isMonday || projectCheckinOverdue)
              const inQA = p.status === 'qa'
              const signedOff = !!p.releaseSignOff

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border ${
                    ci?.onTrack === 'no'
                      ? 'border-red-200 bg-red-50'
                      : ci?.onTrack === 'at_risk'
                        ? 'border-amber-100 bg-amber-50'
                        : inQA
                          ? 'border-blue-100 bg-blue-50'
                          : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-sm font-semibold text-gray-900 hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`badge text-xs ${
                            p.status === 'qa'
                              ? 'bg-teal-100 text-teal-800'
                              : p.status === 'active'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {p.status}
                        </span>
                        {signedOff && <QASignOffBadge signed />}
                        {ci?.onTrack === 'no' && (
                          <span className="badge bg-red-100 text-red-800 text-xs">At risk</span>
                        )}
                        {ci?.onTrack === 'at_risk' && (
                          <span className="badge bg-amber-100 text-amber-800 text-xs">Monitor</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      {needsCheckin && (
                        <Link
                          href="/checkin"
                          className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
                        >
                          Check-in due →
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    {calculatedProgress !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              calculatedProgress >= 80
                                ? 'bg-green-500'
                                : calculatedProgress >= 50
                                  ? 'bg-amber-400'
                                  : calculatedProgress >= 25
                                    ? 'bg-blue-500'
                                    : 'bg-gray-400'
                            }`}
                            style={{ width: `${calculatedProgress}%` }}
                          />
                        </div>
                        <span>{calculatedProgress}%</span>
                      </div>
                    )}
                    {milestone && (
                      <span
                        className={
                          isLate
                            ? 'text-red-600 font-medium'
                            : isUrgent
                              ? 'text-amber-700 font-medium'
                              : ''
                        }
                      >
                        {isLate
                          ? `⚠ "${milestone.title}" overdue by ${Math.abs(daysLeft!)}d`
                          : daysLeft === 0
                            ? `"${milestone.title}" due today`
                            : `"${milestone.title}" in ${daysLeft}d`}
                      </span>
                    )}
                    {ci?.blockers && (
                      <span className="text-amber-700 truncate max-w-64">⚠ {ci.blockers}</span>
                    )}
                  </div>
                </div>
              )
            })}
            {myProjects.length > 3 && (
              <Link
                href="/projects"
                className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-colors"
              >
                +{myProjects.length - 3} more project{myProjects.length - 3 === 1 ? '' : 's'} →
              </Link>
            )}
          </div>
        </MeSection>
      )}

      {isBD && myLeads.length > 0 && (
        <MeSection title="Your pipeline" icon="📈" actionHref="/pipeline" actionLabel="Full pipeline →">
          <div className="space-y-1.5">
            {myLeads.map(lead => {
              const lastActivity = lead.proposals[0]?.sentAt || lead.createdAt
              const daysSince = differenceInDays(today, new Date(lastActivity))
              const stale = daysSince >= 5
              const STATUS_LABEL: Record<string, string> = {
                new: 'New',
                proposal_sent: 'Proposal sent',
                interview: 'Interview',
              }
              return (
                <div
                  key={lead.id}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg border ${
                    stale ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{lead.clientName}</span>
                    <span
                      className={`badge text-xs ${
                        lead.status === 'interview'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {STATUS_LABEL[lead.status as keyof typeof STATUS_LABEL] ?? lead.status}
                    </span>
                    {stale && (
                      <span className="text-xs text-amber-700">No update in {daysSince}d</span>
                    )}
                  </div>
                  <Link
                    href={`/pipeline/${lead.id}`}
                    className="text-xs text-gray-500 hover:text-gray-800 hover:underline"
                  >
                    View →
                  </Link>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {isQA && qaProjects.length > 0 && (
        <MeSection title="Projects needing QA" icon="🔍" actionHref="/qa" actionLabel="QA dashboard →">
          <div className="space-y-2">
            {qaProjects.map(p => {
              const cycle = p.testCycles[0]
              const signed = !!p.releaseSignOff
              const hasIssue = p.postDeliveryIssues.length > 0
              const milestoneProgress = projectMilestoneProgress(p.milestones)
              const cycleProgress = latestCycleProgress(cycle)
              const cycleFixSummary = cycle?.cases?.length
                ? testCycleCaseSummary(cycle.cases)
                : null

              let stateLabel: string
              let stateCls: string
              let action: string | null
              if (signed) {
                stateLabel = '✓ Signed off'
                stateCls = 'bg-green-100 text-green-700'
                action = null
              } else if (!cycle) {
                stateLabel = 'No test cycle'
                stateCls = 'bg-gray-100 text-gray-500'
                action = 'Open project →'
              } else if (isBlockingCycleResult(cycle.result)) {
                if (cycleFixSummary?.allFailuresFixed) {
                  stateLabel = 'Re-test needed'
                  stateCls = 'bg-teal-100 text-teal-800'
                  action = 'Open project →'
                } else if (cycle.result === 'blocked') {
                  stateLabel = 'Blocked'
                  stateCls = 'bg-orange-100 text-orange-800'
                  action = 'Open project →'
                } else {
                  stateLabel = 'Failed'
                  stateCls = 'bg-red-100 text-red-700'
                  action = 'Open project →'
                }
              } else if (cycle.result === 'pass' || cycle.result === 'conditional') {
                stateLabel = 'Ready to sign off'
                stateCls = 'bg-amber-100 text-amber-800'
                action = 'Open project →'
              } else {
                stateLabel = 'In progress'
                stateCls = 'bg-blue-100 text-blue-800'
                action = 'Open project →'
              }

              return (
                <div key={p.id} className="py-3 px-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Link
                          href={`/qa/${p.id}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className={`badge text-xs ${stateCls}`}>{stateLabel}</span>
                        <span className="badge text-xs bg-blue-100 text-blue-800">{p.status}</span>
                        {hasIssue && (
                          <span className="badge bg-red-100 text-red-700 text-xs">
                            Client issue open
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {milestoneProgress.total > 0 && (
                          <div className="rounded-md bg-white border border-gray-100 px-2.5 py-2">
                            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                              <span className="font-medium text-gray-700">Milestones</span>
                              <span>
                                {milestoneProgress.approved}/{milestoneProgress.total} approved
                              </span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-1">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${milestoneProgress.pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {cycleProgress && (
                          <div className="rounded-md bg-white border border-gray-100 px-2.5 py-2">
                            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                              <span className="font-medium text-gray-700">Test cycle</span>
                              <span className="capitalize">{cycleProgress.result}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {cycleProgress.passed}/{cycleProgress.total} cases passed
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {action && (
                      <Link
                        href={`/qa/${p.id}`}
                        className="text-xs text-gray-500 hover:text-gray-800 hover:underline shrink-0 self-start"
                      >
                        {action}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {myOpenBlockers.length > 0 && (
        <MeSection title="Your open blockers" icon="⚠️" badge={String(myOpenBlockers.length)}>
          <div className="space-y-2">
            {myOpenBlockers.map(b => {
              const ageDays = differenceInDays(today, new Date(b.raisedAt))
              return (
                <div
                  key={b.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    ageDays >= 2 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 text-sm font-bold mt-0.5 ${
                      ageDays >= 2 ? 'text-red-600' : 'text-amber-700'
                    }`}
                  >
                    {ageDays}d
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{b.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      {b.project && <span>{b.project.name}</span>}
                      <span className="capitalize">{b.status.replace('_', ' ')}</span>
                      {b.escalatedToFounder && (
                        <span className="text-blue-600 font-medium">Escalated to Shiven ✓</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {sortedGoals.length > 0 && (
        <MeSection
          title="Your goals this quarter"
          icon="🎯"
          badge={`${activeGoals.length} active${closedGoals.length > 0 ? ` · ${closedGoals.length} closed` : ''}`}
        >
          <div className="space-y-3">
            {sortedGoals.map(g => (
              <div
                key={g.id}
                className={`rounded-lg p-3 ${
                  g.status === 'achieved'
                    ? 'bg-green-50 border border-green-100'
                    : g.status === 'missed'
                      ? 'bg-red-50 border border-red-100'
                      : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-800 font-medium">{g.title}</span>
                      {g.status === 'achieved' && (
                        <span className="badge bg-green-100 text-green-800 text-xs">✓ Achieved</span>
                      )}
                      {g.status === 'missed' && (
                        <span className="badge bg-red-100 text-red-800 text-xs">✗ Missed</span>
                      )}
                      <span className="text-xs text-gray-400">{g.quarter}</span>
                    </div>
                  </div>
                  {g.status === 'active' && (
                    <span
                      className={`text-sm font-semibold flex-shrink-0 ${
                        g.progressPct >= 80
                          ? 'text-green-700'
                          : g.progressPct >= 50
                            ? 'text-amber-700'
                            : 'text-red-500'
                      }`}
                    >
                      {g.progressPct}%
                    </span>
                  )}
                </div>
                {g.status === 'active' && (
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        g.progressPct >= 80
                          ? 'bg-green-500'
                          : g.progressPct >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                      }`}
                      style={{ width: `${g.progressPct}%` }}
                    />
                  </div>
                )}
                {g.successMetric && (
                  <p className="text-xs text-gray-400 mt-1.5">Done when: {g.successMetric}</p>
                )}
              </div>
            ))}
          </div>
        </MeSection>
      )}

      <MeSection
        title="This week's score"
        icon="📊"
        headerActions={
          !checkinDone ? (
            <Link
              href="/checkin"
              className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 shrink-0"
            >
              Submit check-in →
            </Link>
          ) : undefined
        }
      >
        {!checkinDone ? (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">Weekly check-in not submitted yet.</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Due every Monday. Covers your project status and your self-score for the week.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-green-50 border border-green-100 rounded-lg mb-3">
            <p className="text-sm text-green-800 font-medium">✓ Weekly check-in submitted</p>
            <p className="text-xs text-green-600 mt-0.5">Next check-in due Monday morning.</p>
          </div>
        )}

        {checkinDone && thisWeekScore && (
          <div className="space-y-2.5">
            {(['delivery', 'process', 'communication', 'growth', 'culture'] as const).map(dim => {
              const val = thisWeekScore[dim] as number
              return (
                <div key={dim} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 capitalize">{dim}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        val >= 8 ? 'bg-green-500' : val >= 6 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${val * 10}%` }}
                    />
                  </div>
                  <span
                    className={`text-sm font-semibold w-5 text-right ${
                      val >= 8 ? 'text-green-700' : val >= 6 ? 'text-amber-700' : 'text-red-600'
                    }`}
                  >
                    {val}
                  </span>
                </div>
              )
            })}
            {scoreAvg !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                <span>
                  4-week avg: <strong className="text-gray-800">{scoreAvg.toFixed(1)}</strong>
                </span>
                {scoreTrend !== null && (
                  <span
                    className={
                      scoreTrend > 0.1
                        ? 'text-green-600'
                        : scoreTrend < -0.1
                          ? 'text-red-500'
                          : 'text-gray-400'
                    }
                  >
                    {scoreTrend > 0.1
                      ? `▲ +${scoreTrend.toFixed(1)}`
                      : scoreTrend < -0.1
                        ? `▼ ${scoreTrend.toFixed(1)}`
                        : '→ Steady'}{' '}
                    vs prev 4 weeks
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </MeSection>
    </>
  )
}
