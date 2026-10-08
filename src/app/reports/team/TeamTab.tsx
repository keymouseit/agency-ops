import Link from 'next/link'
import { subDays, subWeeks } from 'date-fns'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { avg, getWeekStart, preferFounderWeeklyScores } from '@/lib/utils'
import { businessDayKey, businessDayStart } from '@/lib/daily'
import {
  getExpectedHoursBatch,
  sumExpectedHoursForKeys,
  STANDARD_DAY_HOURS,
} from '@/lib/expected-hours'
import ScoreRubricLegend from '@/components/ScoreRubricLegend'
import ClickableRow from '@/components/ClickableRow'
import SubmitScoreForm from '@/app/team/SubmitScoreForm'
import {
  FullOnly,
  LowActivityNote,
  PeopleCount,
  ScopedRow,
  ScopedScoreTrend,
  ShowAllToggle,
  SelectedWeeklyCard,
  TeamScopeProvider,
  WeeklyScoreStatus,
} from './TeamScope'

/** Roles expected to log daily plans / EOD hours (utilisation is only meaningful for them). */
const DAILY_LOGGING_ROLES = ['Dev', 'Both', 'QA']
/** Low-activity flag: historically <20h on a 40h week → 50% of leave-adjusted expected. */
const LOW_ACTIVITY_RATIO = 20 / (5 * STANDARD_DAY_HOURS)

/** Roles that submit a weekly self-assessment via /api/scores + /checkin. */
const SELF_SCORE_ROLES = ['Dev', 'BD', 'QA', 'Both', 'Founder', 'SocialMedia']

const scoreCol = (v: number) => (v >= 8 ? 'text-gray-900' : v >= 6 ? 'text-amber-700' : 'text-red-600')

function weekdayKeysInclusive(from: Date, to: Date) {
  const keys: string[] = []
  let key = businessDayKey(from)
  const end = businessDayKey(to)
  while (key <= end) {
    const start = businessDayStart(key)
    const wd = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
    }).format(start)
    if (wd !== 'Sat' && wd !== 'Sun') keys.push(key)
    key = businessDayKey(new Date(start.getTime() + 36 * 60 * 60 * 1000))
  }
  return keys
}

/**
 * People overview under the individual report: one row per person — score +
 * trend, active goals, 7-day utilisation, billable %, tasks done. Rubric /
 * this-week submit status / Founder rate included.
 *
 * Scoped to the employee selected in the individual report above
 * (`selectedMemberId` = URL memberId; live changes come via TeamScope),
 * with a "Show all" toggle to see everyone.
 */
export default async function TeamTab({ selectedMemberId }: { selectedMemberId?: string } = {}) {
  const session = await auth()
  const canRate = session?.user?.role === 'Founder'

  const today = businessDayStart()
  const rangeStart = businessDayStart(subDays(today, 6))
  const thisWeek = getWeekStart()
  const thisWeekKey = thisWeek.toISOString().slice(0, 10)
  const weekdayKeys = weekdayKeysInclusive(rangeStart, today)

  const [members, weeklyScores, recentLogs] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        role: true,
        goals: { where: { status: 'active' }, select: { id: true, title: true, progressPct: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.weeklyScore.findMany({
      where: { weekOf: { gte: subWeeks(thisWeek, 7) } },
      select: {
        memberId: true,
        weekOf: true,
        delivery: true,
        process: true,
        communication: true,
        growth: true,
        culture: true,
        founderScore: true,
        repeatedMistake: true,
      },
      orderBy: { weekOf: 'asc' },
    }),
    prisma.dailyLog.findMany({
      where: { date: { gte: rangeStart, lte: today } },
      select: {
        memberId: true,
        planSubmittedAt: true,
        tasks: { select: { status: true, actualHours: true, projectId: true } },
      },
    }),
  ])

  const expectedBatch = await getExpectedHoursBatch(
    members.map(m => m.id),
    rangeStart,
    today,
  )

  // Prefer founder rating when both exist for the same person+week
  const preferredScores = preferFounderWeeklyScores(weeklyScores)

  const overall = (s: (typeof preferredScores)[number]) =>
    avg([s.delivery, s.process, s.communication, s.growth, s.culture])

  // This week self-assessment submit status (self only — founder ratings don't count as "submitted")
  const selfSubmittedIds = new Set(
    weeklyScores
      .filter(
        s =>
          !s.founderScore &&
          s.weekOf.toISOString().slice(0, 10) === thisWeekKey,
      )
      .map(s => s.memberId),
  )

  const formMembers = members.map(m => ({ id: m.id, name: m.name, role: m.role }))

  const rows = members.map(m => {
    const myScores = preferredScores.filter(s => s.memberId === m.id)
    const recentAvg = myScores.length ? avg(myScores.slice(-4).map(overall)) : null
    const prevAvg = myScores.length >= 8 ? avg(myScores.slice(-8, -4).map(overall)) : null
    const scoreTrend = recentAvg != null && prevAvg != null ? recentAvg - prevAvg : null

    const logs = recentLogs.filter(l => l.memberId === m.id)
    const logsDaily = DAILY_LOGGING_ROLES.includes(m.role) && logs.some(l => l.planSubmittedAt)
    const tasks = logs.flatMap(l => l.tasks)
    const loggedHours = tasks.reduce((s, t) => s + (t.actualHours || 0), 0)
    const billableHours = tasks.filter(t => t.projectId).reduce((s, t) => s + (t.actualHours || 0), 0)
    const doneTasks = tasks.filter(t => t.status === 'done').length
    const expectedHours = sumExpectedHoursForKeys(expectedBatch, m.id, weekdayKeys)
    const utilisation =
      expectedHours > 0 ? Math.round((loggedHours / expectedHours) * 100) : 0
    const lowActivityThreshold = expectedHours * LOW_ACTIVITY_RATIO
    return {
      member: m,
      recentAvg,
      scoreTrend,
      logsDaily,
      loggedHours,
      expectedHours,
      utilisation,
      billability: loggedHours > 0 ? Math.round((billableHours / loggedHours) * 100) : null,
      doneTasks,
      totalTasks: tasks.length,
      lowActivity: logsDaily && expectedHours > 0 && loggedHours < lowActivityThreshold,
      submittedSelf: selfSubmittedIds.has(m.id),
    }
  })

  const lowActivityIds = rows.filter(r => r.lowActivity).map(r => r.member.id)

  // Same default as the individual report: URL memberId if valid, else first employee by name.
  const initialSelectedId =
    (selectedMemberId && members.some(m => m.id === selectedMemberId) ? selectedMemberId : members[0]?.id) ??
    null
  const submitPeople = members.map(m => ({
    id: m.id,
    name: m.name,
    role: m.role,
    expected: SELF_SCORE_ROLES.includes(m.role),
    submitted: selfSubmittedIds.has(m.id),
  }))
  const trendScores = preferredScores.map(s => ({
    memberId: s.memberId,
    weekOf: new Date(s.weekOf).toISOString(),
    delivery: s.delivery,
    process: s.process,
    culture: s.culture,
  }))
  const memberNames = Object.fromEntries(members.map(m => [m.id, m.name]))
  const compactPeople = rows.map(r => ({
    id: r.member.id,
    name: r.member.name,
    role: r.member.role,
    expected: SELF_SCORE_ROLES.includes(r.member.role),
    submitted: r.submittedSelf,
    recentAvg: r.recentAvg,
    scoreTrend: r.scoreTrend,
    logsDaily: r.logsDaily,
    loggedHours: r.loggedHours,
    utilisation: r.utilisation,
    billability: r.billability,
    doneTasks: r.doneTasks,
    totalTasks: r.totalTasks,
    lowActivity: r.lowActivity,
    goals: r.member.goals,
  }))

  return (
    <TeamScopeProvider initialMemberId={initialSelectedId}>
    {/* Selected-only: one compact card. Show all: the full layout below. */}
    <SelectedWeeklyCard
      people={compactPeople}
      scores={trendScores}
      canRate={canRate}
      formMembers={formMembers}
      weeksBack={8}
    />
    <FullOnly>
    <div className="space-y-6">
      <ScoreRubricLegend />

      <div className="card px-5 py-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <WeeklyScoreStatus people={submitPeople} />
        {canRate && (
          <div className="shrink-0">
            <SubmitScoreForm members={formMembers} founderMode />
          </div>
        )}
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              People <PeopleCount memberIds={rows.map(r => r.member.id)} />
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Score = avg of last 4 weekly scores (founder rating preferred when both exist) · utilisation, billable and tasks over the last 7 days (Dev / QA roles)
              <LowActivityNote lowActivityIds={lowActivityIds} />
              . Click a row for the individual report.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <ShowAllToggle total={rows.length} />
            <Link href="/goals" className="text-xs text-gray-500 hover:text-gray-900 shrink-0">
              Manage goals →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-2.5 font-medium">Member</th>
                <th className="text-center px-3 py-2.5 font-medium">Score</th>
                <th className="text-center px-3 py-2.5 font-medium">Trend</th>
                <th className="text-left px-3 py-2.5 font-medium">Active goals</th>
                <th className="text-center px-3 py-2.5 font-medium">Logged · 7d</th>
                <th className="text-center px-3 py-2.5 font-medium">Utilisation</th>
                <th className="text-center px-3 py-2.5 font-medium">Billable</th>
                <th className="text-center px-3 py-2.5 font-medium">Tasks done</th>
                {canRate && <th className="text-center px-3 py-2.5 font-medium">Rate</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => {
                const href = `/reports/team?memberId=${encodeURIComponent(r.member.id)}`
                const hasHours = r.logsDaily || r.loggedHours > 0
                return (
                  <ScopedRow key={r.member.id} memberId={r.member.id}>
                  <ClickableRow href={href} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5">
                      <Link href={href} className="font-medium text-gray-900 hover:underline">
                        {r.member.name}
                      </Link>
                      <div className="text-xs text-gray-400">
                        {r.member.role}
                        {SELF_SCORE_ROLES.includes(r.member.role) && (
                          <span className={r.submittedSelf ? ' text-gray-300' : ' text-amber-600'}>
                            {r.submittedSelf ? ' · scored' : ' · missing score'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={`text-center px-3 py-2.5 font-semibold tabular-nums ${r.recentAvg != null ? scoreCol(r.recentAvg) : 'text-gray-300'}`}>
                      {r.recentAvg != null ? r.recentAvg.toFixed(1) : '—'}
                    </td>
                    <td className="text-center px-3 py-2.5 text-xs tabular-nums">
                      {r.scoreTrend != null ? (
                        <span className={r.scoreTrend < 0 ? 'text-red-600' : 'text-gray-500'}>
                          {r.scoreTrend > 0 ? `▲ +${r.scoreTrend.toFixed(1)}` : r.scoreTrend < 0 ? `▼ ${r.scoreTrend.toFixed(1)}` : '→'}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.member.goals.length === 0 ? (
                        <span className="text-xs text-gray-300">No goals set</span>
                      ) : (
                        <div className="space-y-1">
                          {r.member.goals.slice(0, 2).map(g => (
                            <div key={g.id} className="flex items-center gap-2">
                              <div className="w-14 h-1 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                <div className="h-full rounded-full bg-gray-500" style={{ width: `${g.progressPct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 truncate max-w-[10rem]" title={g.title}>
                                {g.title}
                              </span>
                            </div>
                          ))}
                          {r.member.goals.length > 2 && (
                            <div className="text-[11px] text-gray-400">+{r.member.goals.length - 2} more</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className={`text-center px-3 py-2.5 tabular-nums ${r.lowActivity ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                      {hasHours ? `${r.loggedHours.toFixed(1)}h` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      {r.logsDaily ? (
                        <div className="flex items-center gap-1.5 justify-center">
                          <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${r.utilisation >= 80 ? 'bg-gray-500' : r.utilisation >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(r.utilisation, 100)}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs font-medium tabular-nums ${r.utilisation >= 80 ? 'text-gray-700' : r.utilisation >= 60 ? 'text-amber-700' : 'text-red-600'}`}
                          >
                            {r.utilisation}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2.5 text-xs tabular-nums text-gray-700">
                      {r.billability != null ? `${r.billability}%` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="text-center px-3 py-2.5 text-xs tabular-nums text-gray-700">
                      {r.totalTasks > 0 ? (
                        <>
                          {r.doneTasks}/{r.totalTasks}
                          <span className="text-gray-400"> · {Math.round((r.doneTasks / r.totalTasks) * 100)}%</span>
                        </>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    {canRate && (
                      <td className="text-center px-3 py-2.5">
                        <SubmitScoreForm
                          members={formMembers}
                          founderMode
                          initialMemberId={r.member.id}
                          lockMember
                          buttonLabel="Rate"
                          buttonClassName="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md border border-gray-200 hover:bg-gray-50"
                        />
                      </td>
                    )}
                  </ClickableRow>
                  </ScopedRow>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex flex-wrap gap-x-6 gap-y-1">
          <span>Utilisation target: 80%+ of leave-adjusted expected hours (~40h week minus approved leave)</span>
          <span>Billable target: 70%+ of logged hours</span>
          <span>&lt;50% of expected hours in 7 days = low activity</span>
        </div>
      </section>

      <ScopedScoreTrend scores={trendScores} names={memberNames} weeksBack={8} />
    </div>
    </FullOnly>
    </TeamScopeProvider>
  )
}
