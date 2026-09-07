import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { findPendingPastEodLogSummary } from '@/lib/daily'
import { format, startOfDay, subDays } from 'date-fns'
import { redirect } from 'next/navigation'
import DailyHeader from './DailyHeader'
import DailyStats from './DailyStats'
import DailyAlerts from './DailyAlerts'
import DailyEmptyState from './DailyEmptyState'
import DailyLogCard from './DailyLogCard'

export const dynamic = 'force-dynamic'

export default async function DailyPage({
  searchParams,
}: {
  searchParams: { date?: string; view?: string; saved?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const targetDate = searchParams.date
    ? startOfDay(new Date(searchParams.date))
    : startOfDay(new Date())

  const isFounder = session.user.role === 'Founder'
  const viewMode = searchParams.view || 'team'
  const showTeamView = isFounder && viewMode === 'team'

  const [members, logs, pendingPastEodLog] = await Promise.all([
    showTeamView
      ? prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
      : prisma.teamMember.findMany({ where: { id: session.user.id }, orderBy: { name: 'asc' } }),
    prisma.dailyLog.findMany({
      where: {
        date: targetDate,
        ...(showTeamView ? {} : { memberId: session.user.id }),
      },
      include: {
        member: true,
        tasks: { include: { project: { select: { name: true } } }, orderBy: { priority: 'asc' } },
      },
    }),
    showTeamView ? Promise.resolve(null) : findPendingPastEodLogSummary(session.user.id),
  ])

  const isToday = targetDate.toDateString() === new Date().toDateString()
  const prevDate = format(subDays(targetDate, 1), 'yyyy-MM-dd')
  const nextDate = format(new Date(targetDate.getTime() + 86400000), 'yyyy-MM-dd')
  const dateLabel = format(targetDate, 'EEEE, d MMMM yyyy')

  const myLog = logs.find(l => l.memberId === session.user.id)
  const canEditPlan = isToday && !!myLog?.planSubmittedAt && !myLog?.eodSubmittedAt
  const canNewPlan = isToday && !!myLog?.eodSubmittedAt

  const membersWithLog = new Set(logs.map(l => l.memberId))
  const noPlan = members.filter(m => !membersWithLog.has(m.id))
  const noEOD = logs.filter(l => l.planSubmittedAt && !l.eodSubmittedAt)
  const hasBlockers = logs.filter(l => l.blockers && l.blockers.trim())

  const allTasks = logs.flatMap(l => l.tasks)
  const plannedTasks = allTasks.length
  const doneTasks = allTasks.filter(t => t.status === 'done').length
  const blockedTasks = allTasks.filter(t => t.status === 'blocked').length
  const totalEstHours = allTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const totalActHours = allTasks
    .filter(t => t.eodNotes !== null || t.status !== 'planned')
    .reduce((s, t) => s + (t.actualHours ?? 0), 0)

  const planJustSaved = searchParams.saved === '1'

  const stats = [
    ...(showTeamView
      ? [
          {
            label: 'Plans submitted',
            value: `${logs.length}/${members.length}`,
            icon: '📋',
            good: logs.length === members.length,
            bad: logs.length < members.length && isToday,
          },
        ]
      : []),
    {
      label: showTeamView ? 'Tasks planned' : 'Tasks planned today',
      value: plannedTasks.toString(),
      icon: '✓',
    },
    {
      label: showTeamView ? 'Tasks done' : 'Tasks completed',
      value: doneTasks.toString(),
      icon: '✅',
      good: doneTasks === plannedTasks && plannedTasks > 0,
    },
    {
      label: 'Tasks blocked',
      value: blockedTasks.toString(),
      icon: '🚫',
      bad: blockedTasks > 0,
    },
    {
      label: 'Hours logged',
      value: totalActHours > 0 ? `${totalActHours}h / ${totalEstHours}h` : `${totalEstHours}h planned`,
      icon: '⏱',
    },
  ]

  return (
    <div>
      {planJustSaved && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span aria-hidden>✓</span>
          Plan saved — your tasks for today are below.
        </div>
      )}

      <DailyHeader
        isFounder={isFounder}
        showTeamView={showTeamView}
        viewMode={viewMode}
        dateParam={searchParams.date}
        dateLabel={dateLabel}
        isToday={isToday}
        prevDate={prevDate}
        nextDate={nextDate}
        canEditPlan={canEditPlan}
        canNewPlan={canNewPlan}
        pendingEodLogId={pendingPastEodLog?.id}
      />

      {showTeamView && isToday && (
        <DailyAlerts noPlan={noPlan} noEOD={noEOD} blockers={hasBlockers} />
      )}

      {(plannedTasks > 0 || logs.length > 0) && <DailyStats stats={stats} />}

      {logs.length === 0 ? (
        <DailyEmptyState showTeamView={showTeamView} isToday={isToday} />
      ) : (
        <div className="space-y-4">
          {logs.map(log => (
            <DailyLogCard
              key={log.id}
              log={log}
              isToday={isToday}
              currentUserId={session.user.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
