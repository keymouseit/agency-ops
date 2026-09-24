import Link from 'next/link'
import { differenceInDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { businessDayStart } from '@/lib/daily'
import { latestCycleProgress, projectMilestoneProgress } from '@/lib/qa-dashboard'
import { isBlockingCycleResult, testCycleCaseSummary } from '@/lib/qa'
import { milestoneListOrderBy } from '@/lib/project-queries'
import MeSection from './MeSection'

type Props = {
  memberId: string
  role: string
}

/** Remaining /me streams — pipeline, QA, blockers, goals (projects + score live elsewhere). */
export default async function MeRightRail({ memberId, role }: Props) {
  const today = businessDayStart()
  const isBD = role === 'BD' || role === 'Both'
  const isQA = role === 'QA'
  const isDev = role === 'Dev' || role === 'Both'

  const [myLeads, myOpenBlockers, myGoals, qaProjects] = await Promise.all([
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

  const goalStatusOrder: Record<string, number> = { active: 0, achieved: 1, missed: 2 }
  const sortedGoals = [...myGoals].sort(
    (a, b) =>
      (goalStatusOrder[a.status] ?? 9) - (goalStatusOrder[b.status] ?? 9) ||
      a.progressPct - b.progressPct,
  )
  const activeGoals = sortedGoals.filter(g => g.status === 'active')
  const closedGoals = sortedGoals.filter(g => g.status !== 'active')

  return (
    <>
      {isBD && myLeads.length > 0 && (
        <MeSection
          title="Your pipeline"
          icon="📈"
          actionHref="/pipeline"
          actionLabel="Full pipeline →"
          className="me-stagger-2"
        >
          <div className="divide-y divide-gray-100 -mx-1">
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
                  className={`flex items-center justify-between gap-2 py-2.5 px-1 ${
                    stale ? 'bg-amber-50/40 -mx-1 px-2 rounded-md' : ''
                  }`}
                >
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{lead.clientName}</span>
                    <span
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${
                        lead.status === 'interview'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : 'bg-gray-50 text-gray-600 border-gray-200'
                      }`}
                    >
                      {STATUS_LABEL[lead.status as keyof typeof STATUS_LABEL] ?? lead.status}
                    </span>
                    {stale && (
                      <span className="text-[11px] text-amber-700">No update in {daysSince}d</span>
                    )}
                  </div>
                  <Link
                    href={`/pipeline/${lead.id}`}
                    className="text-xs text-gray-500 hover:text-gray-900 shrink-0 transition-colors"
                  >
                    View
                  </Link>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {isQA && qaProjects.length > 0 && (
        <MeSection
          title="Projects needing QA"
          icon="🔍"
          actionHref="/qa"
          actionLabel="QA dashboard →"
          className="me-stagger-2"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                stateLabel = 'Signed off'
                stateCls = 'bg-emerald-50 text-emerald-700 border-emerald-200'
                action = null
              } else if (!cycle) {
                stateLabel = 'No test cycle'
                stateCls = 'bg-gray-50 text-gray-600 border-gray-200'
                action = 'Open'
              } else if (isBlockingCycleResult(cycle.result)) {
                if (cycleFixSummary?.allFailuresFixed) {
                  stateLabel = 'Re-test needed'
                  stateCls = 'bg-teal-50 text-teal-800 border-teal-200'
                  action = 'Open'
                } else if (cycle.result === 'blocked') {
                  stateLabel = 'Blocked'
                  stateCls = 'bg-orange-50 text-orange-800 border-orange-200'
                  action = 'Open'
                } else {
                  stateLabel = 'Failed'
                  stateCls = 'bg-red-50 text-red-700 border-red-200'
                  action = 'Open'
                }
              } else if (cycle.result === 'pass' || cycle.result === 'conditional') {
                stateLabel = 'Ready to sign off'
                stateCls = 'bg-amber-50 text-amber-800 border-amber-200'
                action = 'Open'
              } else {
                stateLabel = 'In progress'
                stateCls = 'bg-sky-50 text-sky-800 border-sky-200'
                action = 'Open'
              }

              return (
                <div key={p.id} className="me-card-lift rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Link
                          href={`/qa/${p.id}`}
                          className="text-sm font-medium text-gray-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${stateCls}`}>
                          {stateLabel}
                        </span>
                        {hasIssue && (
                          <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">
                            Client issue
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-1.5">
                        {milestoneProgress.total > 0 && (
                          <div className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1.5">
                            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                              <span className="font-medium text-gray-700">Milestones</span>
                              <span className="tabular-nums">
                                {milestoneProgress.approved}/{milestoneProgress.total}
                              </span>
                            </div>
                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="me-progress-fill h-full bg-emerald-500 rounded-full"
                                style={{ width: `${milestoneProgress.pct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {cycleProgress && (
                          <div className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1.5">
                            <div className="flex justify-between text-[11px] text-gray-500">
                              <span className="font-medium text-gray-700">Test cycle</span>
                              <span className="capitalize tabular-nums">
                                {cycleProgress.passed}/{cycleProgress.total} · {cycleProgress.result}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {action && (
                      <Link
                        href={`/qa/${p.id}`}
                        className="text-xs text-gray-500 hover:text-gray-900 shrink-0 transition-colors"
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
        <MeSection
          title="Your open blockers"
          icon="⚠️"
          badge={String(myOpenBlockers.length)}
          className="me-stagger-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {myOpenBlockers.map(b => {
              const ageDays = differenceInDays(today, new Date(b.raisedAt))
              const aged = ageDays >= 2
              return (
                <div
                  key={b.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    aged
                      ? 'border-red-200 bg-red-50/40'
                      : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 text-xs font-semibold tabular-nums mt-0.5 ${
                      aged ? 'text-red-600' : 'text-amber-700'
                    }`}
                  >
                    {ageDays}d
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{b.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                      {b.project && <span>{b.project.name}</span>}
                      <span className="capitalize">{b.status.replace('_', ' ')}</span>
                      {b.escalatedToFounder && (
                        <span className="text-sky-700 font-medium">Escalated</span>
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
          className="me-stagger-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {sortedGoals.map(g => (
              <div
                key={g.id}
                className={`rounded-lg p-3 border ${
                  g.status === 'achieved'
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : g.status === 'missed'
                      ? 'bg-red-50/40 border-red-200'
                      : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm text-gray-800 font-medium">{g.title}</span>
                      {g.status === 'achieved' && (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                          Achieved
                        </span>
                      )}
                      {g.status === 'missed' && (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-800 border border-red-200">
                          Missed
                        </span>
                      )}
                      <span className="text-[11px] text-gray-400">{g.quarter}</span>
                    </div>
                  </div>
                  {g.status === 'active' && (
                    <span
                      className={`text-sm font-semibold flex-shrink-0 tabular-nums ${
                        g.progressPct >= 80
                          ? 'text-emerald-700'
                          : g.progressPct >= 50
                            ? 'text-amber-700'
                            : 'text-red-600'
                      }`}
                    >
                      {g.progressPct}%
                    </span>
                  )}
                </div>
                {g.status === 'active' && (
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`me-progress-fill h-full rounded-full ${
                        g.progressPct >= 80
                          ? 'bg-emerald-500'
                          : g.progressPct >= 50
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                      }`}
                      style={{ width: `${g.progressPct}%` }}
                    />
                  </div>
                )}
                {g.successMetric && (
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">Done when: {g.successMetric}</p>
                )}
              </div>
            ))}
          </div>
        </MeSection>
      )}
    </>
  )
}
