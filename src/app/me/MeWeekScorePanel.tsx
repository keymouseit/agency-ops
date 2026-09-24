import Link from 'next/link'
import { startOfWeek, subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { avg, isSameWeek } from '@/lib/utils'
import { businessDayStart } from '@/lib/daily'
import { assignedToMemberWhere } from '@/lib/project-assignees'
import MeSection from './MeSection'

type Props = {
  memberId: string
  role: string
  hasCheckin: boolean
}

/** This week's score / check-in — used as a secondary-row panel beside attendance. */
export default async function MeWeekScorePanel({ memberId, role, hasCheckin }: Props) {
  const today = businessDayStart()
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isDev = role === 'Dev' || role === 'Both'

  const [thisWeekScore, recentScores, myProjects] = await Promise.all([
    prisma.weeklyScore.findFirst({
      where: { memberId, weekOf: thisWeek, founderScore: false },
    }),
    prisma.weeklyScore.findMany({
      where: { memberId, founderScore: false, weekOf: { gte: subDays(thisWeek, 56) } },
      orderBy: { weekOf: 'asc' },
    }),
    isDev
      ? prisma.project.findMany({
          where: { AND: [assignedToMemberWhere(memberId), { status: { in: ['scoping', 'active', 'qa'] } }] },
          select: {
            id: true,
            checkIns: {
              where: { submittedById: memberId },
              orderBy: { weekOf: 'desc' },
              take: 1,
              select: { weekOf: true },
            },
          },
        })
      : Promise.resolve([] as { id: string; checkIns: { weekOf: Date }[] }[]),
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

  const checkinDone = hasCheckin || !!thisWeekScore
  const projectsMissingCheckin = isDev
    ? myProjects.filter(p => {
        const ci = p.checkIns[0]
        return !(ci && isSameWeek(ci.weekOf, today))
      }).length
    : 0

  return (
    <MeSection
      title="This week's score"
      icon="📊"
      className="me-stagger-4 mb-0 h-full"
      dense
      headerActions={
        !checkinDone || projectsMissingCheckin > 0 ? (
          <Link
            href="/checkin"
            className="me-btn-premium me-btn-premium-dark text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 shrink-0 font-medium"
          >
            {!checkinDone ? 'Submit check-in' : 'Check in projects'}
          </Link>
        ) : undefined
      }
    >
      {!checkinDone ? (
        <div className="me-callout me-callout-warn">
          <p className="text-sm text-amber-900 font-medium">Weekly check-in not submitted yet.</p>
          <p className="text-xs text-amber-700/80 mt-0.5 leading-relaxed">
            Due every Monday. Covers your project status and your self-score for the week.
          </p>
        </div>
      ) : (
        <div className="me-callout me-callout-success mb-3">
          <p className="text-sm text-emerald-900 font-medium">Weekly self-assessment submitted</p>
          <p className="text-xs text-emerald-700/80 mt-0.5 leading-relaxed">
            {projectsMissingCheckin > 0
              ? `${projectsMissingCheckin} project${projectsMissingCheckin === 1 ? '' : 's'} still need a check-in this week.`
              : 'Next check-in due Monday morning.'}
          </p>
          {projectsMissingCheckin > 0 && (
            <Link href="/checkin" className="inline-block mt-2 text-xs font-medium text-emerald-800 hover:underline">
              Check in remaining projects
            </Link>
          )}
        </div>
      )}

      {checkinDone && thisWeekScore && (
        <div className="space-y-2.5">
          {(['delivery', 'process', 'communication', 'growth', 'culture'] as const).map(dim => {
            const val = thisWeekScore[dim] as number
            return (
              <div key={dim} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-24 capitalize shrink-0">{dim}</span>
                <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`me-progress-fill h-full rounded-full ${
                      val >= 8 ? 'bg-emerald-500' : val >= 6 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${val * 10}%` }}
                  />
                </div>
                <span
                  className={`text-sm font-semibold w-5 text-right tabular-nums ${
                    val >= 8 ? 'text-emerald-700' : val >= 6 ? 'text-amber-700' : 'text-red-600'
                  }`}
                >
                  {val}
                </span>
              </div>
            )
          })}
          {scoreAvg !== null && (
            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs text-gray-500">
              <span>
                4-week avg: <strong className="text-gray-800 tabular-nums">{scoreAvg.toFixed(1)}</strong>
              </span>
              {scoreTrend !== null && (
                <span
                  className={
                    scoreTrend > 0.1
                      ? 'text-emerald-600'
                      : scoreTrend < -0.1
                        ? 'text-red-600'
                        : 'text-gray-400'
                  }
                >
                  {scoreTrend > 0.1
                    ? `↑ +${scoreTrend.toFixed(1)}`
                    : scoreTrend < -0.1
                      ? `↓ ${scoreTrend.toFixed(1)}`
                      : '→ Steady'}{' '}
                  vs prev 4 weeks
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </MeSection>
  )
}

export function MeWeekScorePanelFallback() {
  return (
    <div className="me-surface p-5 h-full animate-pulse" aria-hidden>
      <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
      <div className="h-16 bg-gray-100 rounded-lg" />
    </div>
  )
}
