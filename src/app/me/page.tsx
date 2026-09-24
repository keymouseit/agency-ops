import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { startOfWeek } from 'date-fns'
import { isIstWeekend } from '@/lib/ist'
import Link from 'next/link'
import { fmtDate, timeGreeting } from '@/lib/utils'
import MePlanWidget from './MePlanWidget'
import MeDayHeader from './MeDayHeader'
import MeSection from './MeSection'
import MeLeaveSection, { MeLeaveSectionFallback } from './MeLeaveSection'
import MeRightRail from './MeRightRail'
import MeProjectsGrid from './MeProjectsGrid'
import MeWeekScorePanel, { MeWeekScorePanelFallback } from './MeWeekScorePanel'
import { CardSectionFallback } from '@/components/SectionFallbacks'
import { canEditEod, businessDayStart, findPendingPastEodLogSummary, formatDailyLogDate, findCarryOverMovedTasks } from '@/lib/daily'
import MovedTasksCard from './MovedTasksCard'

export const dynamic = 'force-dynamic'

// ─── What each role sees ───────────────────────────────────────────────────
// Dev:  today · my projects · estimate tasks · blockers · goals · score
// BD:   today · my pipeline · estimates awaiting review · goals · score
// QA:   today · projects needing QA · blockers · goals · score
// Both: combined
//
// Layout (top → bottom):
// 1. Compact strip — greeting + date + status pills
// 2. Primary stage — Today / morning plan (full width)
// 3. Secondary row — Attendance | This week's score
// 4. Projects grid — full-width 2–3 cols
// 5. Extras — estimates, pipeline, QA, blockers, goals

export default async function MePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role === 'Founder') redirect('/')

  const memberId = session.user.id
  const role     = session.user.role as string
  const today    = businessDayStart()
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const isWeekday = !isIstWeekend()

  const isDev = role === 'Dev' || role === 'Both'
  const isBD  = role === 'BD'  || role === 'Both'

  const [
    member,
    todayLog,
    pendingPastEodLog,
    devEstimates,
    bdEstimates,
    thisWeekScore,
    carryOverMoved,
  ] = await Promise.all([
    prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, role: true, email: true, active: true },
    }),
    prisma.dailyLog.findUnique({
      where: { memberId_date: { memberId, date: today } },
      include: {
        tasks: {
          include: { project: { select: { name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    }),
    findPendingPastEodLogSummary(memberId),
    isDev
      ? prisma.estimationRequest.findMany({
          where: {
            assignedTo: memberId,
            status: { in: ['pending', 'in_progress', 'revision'] },
          },
          select: {
            id: true,
            leadId: true,
            status: true,
            dueBy: true,
            notes: true,
            lead: { select: { clientName: true } },
            record: { select: { bdRevisionNote: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    isBD
      ? prisma.estimationRequest.findMany({
          where: {
            requestedBy: memberId,
            status: { in: ['confirmed'] },
          },
          select: {
            id: true,
            leadId: true,
            status: true,
            lead: { select: { clientName: true } },
            assignee: { select: { name: true } },
            record: {
              select: {
                totalHoursFinal: true,
                totalPriceFinal: true,
                overallRisk: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
    prisma.weeklyScore.findFirst({
      where: { memberId, weekOf: thisWeek, founderScore: false },
    }),
    findCarryOverMovedTasks(memberId),
  ])

  if (!member) redirect('/api/auth/signout?callbackUrl=/login')

  const hasPlan        = !!todayLog?.planSubmittedAt
  const hasEOD         = !!todayLog?.eodSubmittedAt
  const canEditTodayEOD = hasEOD && canEditEod(todayLog?.eodSubmittedAt)
  const missingPastEOD = !!pendingPastEodLog
  const pendingEodDateLabel = pendingPastEodLog ? formatDailyLogDate(pendingPastEodLog.date) : ''
  const todayTasks     = todayLog?.tasks ?? []
  const doneTasks      = todayTasks.filter(t => t.status === 'done').length
  const blockedTasks   = todayTasks.filter(t => t.status === 'blocked').length
  const totalHours     = todayTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const hasCheckin  = !!thisWeekScore
  const firstName = member.name.split(' ')[0]
  const greeting  = timeGreeting()

  const PRIORITY_DOT: Record<string, string> = {
    high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-gray-300',
  }
  const TASK_STATUS_CLS: Record<string, string> = {
    done: 'line-through text-gray-400',
    blocked: 'text-red-700',
    partial: 'text-amber-700',
    moved: 'text-gray-400',
    planned: 'text-gray-800',
  }

  return (
    <div className="me-page">

      {/* 1. Compact top strip */}
      <MeDayHeader
        greeting={greeting}
        firstName={firstName}
        dateLabel={formatDailyLogDate(today)}
        role={role}
        isWeekday={isWeekday}
        hasPlan={hasPlan}
        hasEOD={hasEOD}
        hasCheckin={hasCheckin}
        doneTasks={doneTasks}
        totalTasks={todayTasks.length}
        totalHours={totalHours}
      />

      {/* Urgent: missing past EOD */}
      {missingPastEOD && pendingPastEodLog && (
        <div className="me-enter me-stagger-2 me-callout me-callout-danger mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-red-900">
              Pending EOD from {pendingEodDateLabel}
            </div>
            <div className="text-xs text-red-700/80 mt-0.5 leading-relaxed">
              You submitted a plan but never closed that day. Submit EOD before planning today — hours won&apos;t be logged until you do.
            </div>
          </div>
          <Link
            href={`/daily/eod?logId=${pendingPastEodLog.id}`}
            className="me-btn-premium me-btn-premium-dark inline-flex items-center justify-center shrink-0 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-red-700"
          >
            Submit EOD
          </Link>
        </div>
      )}

      {carryOverMoved && carryOverMoved.tasks.length > 0 && (
        <MovedTasksCard carryOver={carryOverMoved} />
      )}

      {/* 2. Primary stage — Today / morning plan (full width) */}
      <div className="me-stage">
        {isWeekday && (
          <MeSection
            title="Today"
            icon="📋"
            className="me-stagger-3"
            headerActions={
              hasPlan && !hasEOD ? (
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/daily/plan"
                    className="me-btn-premium text-xs px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Edit plan
                  </Link>
                  <Link
                    href="/daily/eod"
                    className="me-btn-premium me-btn-premium-dark text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                  >
                    Submit EOD
                  </Link>
                </div>
              ) : undefined
            }
          >
            {!hasPlan ? (
              missingPastEOD && pendingPastEodLog ? (
                <div className="me-callout me-callout-danger">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-red-950">
                        Submit {pendingEodDateLabel}&apos;s EOD first
                      </p>
                      <p className="text-xs text-red-700/80 mt-1 max-w-md leading-relaxed">
                        Close your previous day before planning today. Your morning plan unlocks once EOD is submitted.
                      </p>
                    </div>
                    <Link
                      href={`/daily/eod?logId=${pendingPastEodLog.id}`}
                      className="me-btn-premium me-btn-premium-dark inline-flex items-center justify-center rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 shrink-0"
                    >
                      Submit EOD
                    </Link>
                  </div>
                </div>
              ) : (
                <MePlanWidget movedCount={carryOverMoved && !carryOverMoved.sameDay ? carryOverMoved.tasks.length : 0} />
              )
            ) : hasEOD ? (
              <div className="me-callout me-callout-success">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">EOD submitted — day closed</p>
                    <p className="text-xs text-emerald-700/80 mt-1 leading-relaxed">
                      {doneTasks} of {todayTasks.length} tasks done.
                      {canEditTodayEOD
                        ? ' You can edit your EOD until the end of today.'
                        : ' Start a new plan if you\'re continuing today.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canEditTodayEOD && todayLog && (
                      <Link
                        href={`/daily/eod?logId=${todayLog.id}`}
                        className="me-btn-premium px-3 py-1.5 border border-emerald-200 text-emerald-800 text-xs rounded-lg hover:bg-emerald-50"
                      >
                        Edit EOD
                      </Link>
                    )}
                    <Link
                      href="/daily/plan"
                      className="me-btn-premium me-btn-premium-dark px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800"
                    >
                      New plan
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                  {[
                    { label: 'Planned', value: `${todayTasks.length}`, sub: `${totalHours}h` },
                    { label: 'Done', value: `${doneTasks}/${todayTasks.length}`, highlight: doneTasks === todayTasks.length && todayTasks.length > 0 },
                    ...(blockedTasks > 0 ? [{ label: 'Blocked', value: String(blockedTasks), danger: true }] : []),
                  ].map(stat => (
                    <div
                      key={stat.label}
                      className="me-card-lift rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-[var(--me-shadow)]"
                    >
                      <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                        {stat.label}
                      </div>
                      <div className={`text-lg font-semibold mt-0.5 tabular-nums ${
                        stat.danger ? 'text-red-600' : stat.highlight ? 'text-emerald-700' : 'text-gray-900'
                      }`}>
                        {stat.value}
                      </div>
                      {'sub' in stat && stat.sub && (
                        <div className="text-xs text-gray-500 tabular-nums">{stat.sub}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                  {todayTasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 px-3.5 py-3 bg-white hover:bg-gray-50/80 transition-colors"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm whitespace-pre-wrap break-words block ${TASK_STATUS_CLS[task.status] ?? 'text-gray-800'}`}>
                          {task.title}
                        </span>
                        {task.project && (
                          <span className="text-xs text-gray-400 mt-0.5 block">{task.project.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.status !== 'planned' && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                            task.status === 'done'    ? 'bg-emerald-50 text-emerald-700'
                            : task.status === 'blocked' ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                            {task.status}
                          </span>
                        )}
                        {task.estimatedHours != null && (
                          <span className="text-xs text-gray-400 tabular-nums">{task.estimatedHours}h</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </MeSection>
        )}

        {/* Estimation tasks (Dev / Both) */}
        {isDev && devEstimates.length > 0 && (
          <MeSection title="Estimates you need to fill" icon="📝" className="me-stagger-4">
            <div className="space-y-2">
              {devEstimates.map(req => {
                const needsRevision = req.status === 'revision'
                return (
                  <div
                    key={req.id}
                    className={`me-card-lift p-3.5 rounded-lg border ${
                      needsRevision
                        ? 'border-red-200 bg-red-50/40'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{req.lead.clientName}</span>
                          {needsRevision && (
                            <span className="inline-flex items-center rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">
                              Revision needed
                            </span>
                          )}
                          {req.dueBy && (
                            <span className={`text-xs ${new Date(req.dueBy) < new Date() ? 'text-red-600' : 'text-gray-400'}`}>
                              Due {fmtDate(req.dueBy)}
                            </span>
                          )}
                        </div>
                        {req.notes && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{req.notes}</p>
                        )}
                        {needsRevision && req.record?.bdRevisionNote && (
                          <p className="text-xs text-red-700 mt-1.5 leading-relaxed">
                            Revision reason: {req.record.bdRevisionNote}
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/estimate/${req.leadId}`}
                        className={`me-btn-premium flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium ${
                          needsRevision
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-gray-900 text-white hover:bg-gray-800'
                        }`}
                      >
                        {needsRevision ? 'Revise' : 'Fill estimate'}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </MeSection>
        )}

        {/* Estimates to review (BD / Both) */}
        {isBD && bdEstimates.length > 0 && (
          <MeSection title="Estimates ready for your review" icon="✅" className="me-stagger-4">
            <div className="space-y-2">
              {bdEstimates.map(req => (
                <div
                  key={req.id}
                  className="me-card-lift flex items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-200 bg-amber-50/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{req.lead.clientName}</span>
                      <span className="inline-flex items-center rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 border border-violet-200">
                        Dev confirmed
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      By {req.assignee.name}
                      {req.record?.totalHoursFinal && ` · ${req.record.totalHoursFinal}h`}
                      {req.record?.totalPriceFinal && ` · $${req.record.totalPriceFinal.toLocaleString()}`}
                      {req.record?.overallRisk && (
                        <span className={`ml-1.5 capitalize ${
                          req.record.overallRisk === 'high' ? 'text-red-600'
                          : req.record.overallRisk === 'medium' ? 'text-amber-700'
                          : 'text-emerald-700'
                        }`}>{req.record.overallRisk} risk</span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/estimate/${req.leadId}`}
                    className="me-btn-premium me-btn-premium-dark flex-shrink-0 text-xs px-3 py-1.5 bg-amber-700 text-white rounded-lg hover:bg-amber-800 font-medium"
                  >
                    Review & approve
                  </Link>
                </div>
              ))}
            </div>
          </MeSection>
        )}
      </div>

      {/* 3. Secondary row — Attendance | Score */}
      <div className="me-secondary-row">
        <Suspense fallback={<MeLeaveSectionFallback />}>
          <MeLeaveAttendancePanel showPending={role === 'HR'} />
        </Suspense>
        <Suspense fallback={<MeWeekScorePanelFallback />}>
          <MeWeekScorePanel memberId={memberId} role={role} hasCheckin={hasCheckin} />
        </Suspense>
      </div>

      {/* 4. Projects — full-width responsive grid */}
      <Suspense fallback={<CardSectionFallback />}>
        <MeProjectsGrid memberId={memberId} role={role} />
      </Suspense>

      {/* 5. Extras — pipeline, QA, blockers, goals */}
      <Suspense fallback={<CardSectionFallback />}>
        <MeRightRail memberId={memberId} role={role} />
      </Suspense>

    </div>
  )
}

/** Attendance panel for the secondary row (includes HR pending when needed). */
async function MeLeaveAttendancePanel({ showPending }: { showPending: boolean }) {
  return (
    <div className="h-full">
      <MeLeaveSection
        showPending={showPending}
        className="mb-0 me-enter me-stagger-4 h-full"
      />
    </div>
  )
}
