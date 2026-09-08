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
import { CardSectionFallback } from '@/components/SectionFallbacks'
import { canEditEod, businessDayStart, findPendingPastEodLogSummary, formatDailyLogDate, findCarryOverMovedTasks } from '@/lib/daily'
import MovedTasksCard from './MovedTasksCard'

export const dynamic = 'force-dynamic'

// ─── What each role sees ───────────────────────────────────────────────────
// Dev:  today · my projects · estimate tasks · blockers · goals · score (rail streams)
// BD:   today · my pipeline · estimates awaiting review · goals · score
// QA:   today · projects needing QA · blockers · goals · score
// Both: combined

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

  // Primary column only — leave + right rail stream via Suspense
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
    blocked: 'text-red-600',
    partial: 'text-amber-700',
    moved: 'text-gray-400',
    planned: 'text-gray-800',
  }

  return (
    <div className="w-full pb-8">

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

      {/* ── URGENT: Missing yesterday's EOD ─────────────────────────────── */}
      {missingPastEOD && pendingPastEodLog && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-red-800">Pending EOD from {pendingEodDateLabel}</div>
            <div className="text-xs text-red-600 mt-0.5">
              You submitted a plan but never closed that day. Submit EOD before planning today — hours won&apos;t be logged until you do.
            </div>
          </div>
          <Link
            href={`/daily/eod?logId=${pendingPastEodLog.id}`}
            className="flex-shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
          >
            Submit EOD →
          </Link>
        </div>
      )}

      <div className="xl:grid xl:grid-cols-12 xl:gap-5 xl:items-start">
        <div className="xl:col-span-7 min-w-0">
      <Suspense fallback={<MeLeaveSectionFallback />}>
        <MeLeaveSection showPending={role === 'HR'} />
      </Suspense>

      {carryOverMoved && carryOverMoved.tasks.length > 0 && (
        <MovedTasksCard carryOver={carryOverMoved} />
      )}

      {isWeekday && (
        <MeSection
          title="Today"
          icon="📋"
          headerActions={
            hasPlan && !hasEOD ? (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/daily/plan"
                  className="text-xs px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-white transition-colors"
                >
                  Edit plan
                </Link>
                <Link
                  href="/daily/eod"
                  className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
                >
                  Submit EOD →
                </Link>
              </div>
            ) : undefined
          }
        >
          {!hasPlan ? (
            missingPastEOD && pendingPastEodLog ? (
              <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white text-lg shadow-sm shrink-0">
                      ⏰
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-red-950">Submit {pendingEodDateLabel}&apos;s EOD first</p>
                      <p className="text-xs text-red-700 mt-1 max-w-md">
                        Close your previous day before planning today. Your morning plan unlocks once EOD is submitted.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/daily/eod?logId=${pendingPastEodLog.id}`}
                    className="inline-flex items-center justify-center px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm shrink-0"
                  >
                    Submit EOD →
                  </Link>
                </div>
              </div>
            ) : (
              <MePlanWidget movedCount={carryOverMoved && !carryOverMoved.sameDay ? carryOverMoved.tasks.length : 0} />
            )
          ) : hasEOD ? (
            <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white text-lg shrink-0">✓</span>
                  <div>
                    <p className="text-sm font-semibold text-green-900">EOD submitted — day closed</p>
                    <p className="text-xs text-green-700 mt-1">
                      {doneTasks} of {todayTasks.length} tasks done.
                      {canEditTodayEOD
                        ? ' You can edit your EOD until the end of today.'
                        : ' Start a new plan if you\'re continuing today.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {canEditTodayEOD && todayLog && (
                    <Link
                      href={`/daily/eod?logId=${todayLog.id}`}
                      className="px-3 py-1.5 border border-green-200 text-green-800 text-xs rounded-lg hover:bg-green-100 transition-colors text-center"
                    >
                      Edit EOD
                    </Link>
                  )}
                  <Link
                    href="/daily/plan"
                    className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 transition-colors text-center"
                  >
                    New plan →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Planned', value: `${todayTasks.length} tasks`, sub: `${totalHours}h` },
                  { label: 'Done', value: `${doneTasks}/${todayTasks.length}`, highlight: doneTasks === todayTasks.length && todayTasks.length > 0 },
                  ...(blockedTasks > 0 ? [{ label: 'Blocked', value: String(blockedTasks), danger: true }] : []),
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                  >
                    <div className="text-[11px] text-gray-400 uppercase tracking-wide">{stat.label}</div>
                    <div className={`text-lg font-semibold mt-0.5 ${
                      stat.danger ? 'text-red-600' : stat.highlight ? 'text-green-700' : 'text-gray-900'
                    }`}>
                      {stat.value}
                    </div>
                    {'sub' in stat && stat.sub && (
                      <div className="text-xs text-gray-500">{stat.sub}</div>
                    )}
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                {todayTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 px-3 py-3 bg-white hover:bg-gray-50/80 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`} />
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          task.status === 'done'    ? 'bg-green-100 text-green-700'
                          : task.status === 'blocked' ? 'bg-red-100 text-red-700'
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

      {/* ── ESTIMATION TASKS (Dev / Both) ────────────────────────────────── */}
      {/* Dev sees: what they need to fill out. No BD context, no lead status, no pipeline. */}
      {isDev && devEstimates.length > 0 && (
        <MeSection title="Estimates you need to fill" icon="📝">
          <div className="space-y-2">
            {devEstimates.map(req => {
              const needsRevision = req.status === 'revision'
              return (
                <div
                  key={req.id}
                  className={`p-3 rounded-xl border ${needsRevision ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900">{req.lead.clientName}</span>
                        {needsRevision && (
                          <span className="badge bg-red-100 text-red-700 text-xs">Revision needed</span>
                        )}
                        {req.dueBy && (
                          <span className={`text-xs ${new Date(req.dueBy) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                            Due {fmtDate(req.dueBy)}
                          </span>
                        )}
                      </div>
                      {/* Show BD's scope notes so dev knows what to estimate */}
                      {req.notes && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{req.notes}</p>
                      )}
                      {/* Show revision reason if sent back */}
                      {needsRevision && req.record?.bdRevisionNote && (
                        <p className="text-xs text-red-700 mt-1 font-medium">
                          Revision reason: {req.record.bdRevisionNote}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/estimate/${req.leadId}`}
                      className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        needsRevision
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-gray-900 text-white hover:bg-gray-700'
                      }`}
                    >
                      {needsRevision ? 'Revise →' : 'Fill estimate →'}
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {/* ── ESTIMATES TO REVIEW (BD / Both) ──────────────────────────────── */}
      {/* BD sees: estimates confirmed by dev, waiting for their approval. */}
      {isBD && bdEstimates.length > 0 && (
        <MeSection title="Estimates ready for your review" icon="✅">
          <div className="space-y-2">
            {bdEstimates.map(req => (
              <div key={req.id} className="flex items-center justify-between p-3 rounded-xl border border-amber-100 bg-amber-50">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-gray-900">{req.lead.clientName}</span>
                    <span className="badge bg-purple-100 text-purple-800 text-xs">Dev confirmed</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    By {req.assignee.name}
                    {req.record?.totalHoursFinal && ` · ${req.record.totalHoursFinal}h`}
                    {req.record?.totalPriceFinal && ` · $${req.record.totalPriceFinal.toLocaleString()}`}
                    {req.record?.overallRisk && (
                      <span className={`ml-2 capitalize ${
                        req.record.overallRisk === 'high' ? 'text-red-500'
                        : req.record.overallRisk === 'medium' ? 'text-amber-600'
                        : 'text-green-600'
                      }`}>{req.record.overallRisk} risk</span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/estimate/${req.leadId}`}
                  className="flex-shrink-0 text-xs px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Review & approve →
                </Link>
              </div>
            ))}
          </div>
        </MeSection>
      )}
        </div>

        <div className="xl:col-span-5 min-w-0">
          <Suspense fallback={<CardSectionFallback />}>
            <MeRightRail memberId={memberId} role={role} hasCheckin={hasCheckin} />
          </Suspense>
        </div>
      </div>

    </div>
  )
}
