import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { startOfDay, startOfWeek, subDays, differenceInDays, format, isWeekend } from 'date-fns'
import Link from 'next/link'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import { fmtDate, avg, isSameWeek, timeGreeting } from '@/lib/utils'
import MePlanWidget from './MePlanWidget'
import MeDayHeader from './MeDayHeader'
import MeSection from './MeSection'
import { canEditEod } from '@/lib/daily'
import { latestCycleProgress, projectMilestoneProgress } from '@/lib/qa-dashboard'
import { testCycleCaseSummary } from '@/lib/qa'

export const dynamic = 'force-dynamic'

// ─── What each role sees ───────────────────────────────────────────────────
// Dev:  today · my projects · estimate tasks (just the task, no BD context) · blockers · goals · score
// BD:   today · my pipeline · estimates awaiting review · goals · score
// QA:   today · projects needing QA · blockers · goals · score
// Both: today · my projects · my pipeline · estimates (both sides) · blockers · goals · score

export default async function MePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role === 'Founder') redirect('/')

  const memberId = session.user.id
  const role     = session.user.role as string
  const today    = startOfDay(new Date())
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday = start of week
  const isWeekday = !isWeekend(today)

  const isDev = role === 'Dev' || role === 'Both'
  const isBD  = role === 'BD'  || role === 'Both'
  const isQA  = role === 'QA'
  // SocialMedia / HR see My Day with today + check-in/score widgets only

  // ── Queries — only fetch what this role actually needs ───────────────────
  const [
    member,
    todayLog,
    yesterdayLog,
    myProjects,
    myLeads,
    devEstimates,     // estimates assigned TO me (Dev fills these)
    bdEstimates,      // estimates I requested that dev has confirmed (BD reviews these)
    myOpenBlockers,
    myGoals,
    thisWeekScore,
    recentScores,
    qaProjects,
  ] = await Promise.all([

    prisma.teamMember.findUnique({ where: { id: memberId } }),

    // Today's log — everyone needs this
    prisma.dailyLog.findUnique({
      where: { memberId_date: { memberId, date: today } },
      include: {
        tasks: {
          include: { project: { select: { name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    }),

    // Yesterday's log — everyone needs this (missing EOD check)
    prisma.dailyLog.findUnique({
      where: { memberId_date: { memberId, date: startOfDay(subDays(today, 1)) } },
      select: { id: true, planSubmittedAt: true, eodSubmittedAt: true },
    }),

    // My projects — Dev and Both only
    // BD and QA do not own projects
    isDev
      ? prisma.project.findMany({
          where: { developerId: memberId, status: { in: ['scoping', 'active', 'qa'] } },
          include: {
            milestones:     { orderBy: { dueDate: 'asc' } }, // Get all milestones for progress calculation
            checkIns:       { orderBy: { weekOf: 'desc' }, take: 1 },
            testCycles:     { orderBy: { startedAt: 'desc' }, take: 1 },
            releaseSignOff: { include: { signedOffBy: true } },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),

    // Active pipeline leads owned by me — BD and Both only
    // Dev and QA never see lead/pipeline data
    isBD
      ? prisma.lead.findMany({
          where: { ownerId: memberId, status: { in: ['new', 'proposal_sent', 'interview'] } },
          orderBy: { updatedAt: 'asc' }, // oldest = most overdue first
          take: 8,
          select: {
            id: true, clientName: true, status: true,
            budget: true, currency: true, updatedAt: true, createdAt: true,
            proposals: { orderBy: { sentAt: 'desc' }, take: 1, select: { sentAt: true } },
          },
        })
      : Promise.resolve([]),

    // Estimation requests ASSIGNED TO me — Dev and Both only
    // Shows: client name (so they know what they're estimating) + status
    // Does NOT show: lead context, BD pipeline info, won/lost status
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
            notes: true,   // scope notes BD wrote — dev needs this
            lead: { select: { clientName: true } },
            record: { select: { bdRevisionNote: true } },
          },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),

    // Estimates I requested that a dev has CONFIRMED — BD and Both only
    // Dev confirmed their numbers, BD now needs to review and approve
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

    // My open blockers — Dev, Both, QA (not BD — BD raises blockers differently)
    (isDev || isQA)
      ? prisma.blocker.findMany({
          where: { memberId, status: { in: ['open', 'in_progress'] } },
          include: { project: { select: { name: true } } },
          orderBy: { raisedAt: 'asc' },
        })
      : Promise.resolve([]),

    // My goals — active plus recently closed (achieved / missed)
    prisma.goal.findMany({
      where: { memberId, status: { in: ['active', 'achieved', 'missed'] } },
      orderBy: [{ quarter: 'desc' }, { updatedAt: 'desc' }],
    }),

    // This week's self-score — everyone
    prisma.weeklyScore.findFirst({
      where: { memberId, weekOf: thisWeek, founderScore: false },
    }),

    // Last 8 weeks for trend — everyone
    prisma.weeklyScore.findMany({
      where: { memberId, founderScore: false, weekOf: { gte: subDays(thisWeek, 56) } },
      orderBy: { weekOf: 'asc' },
    }),

    // Projects needing QA work — QA only
    // Sorted by urgency: blocked > ready to sign off > no cycle yet
    isQA
      ? prisma.project.findMany({
          where: { status: { in: ['active', 'qa'] } },
          include: {
            milestones: {
              orderBy: { dueDate: 'asc' },
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

  if (!member) redirect('/api/auth/signout?callbackUrl=/login')

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasPlan        = !!todayLog?.planSubmittedAt
  const hasEOD         = !!todayLog?.eodSubmittedAt
  const canEditTodayEOD = hasEOD && canEditEod(todayLog?.eodSubmittedAt)
  const missingYestEOD = !!(yesterdayLog?.planSubmittedAt && !yesterdayLog?.eodSubmittedAt)
  const todayTasks     = todayLog?.tasks ?? []
  const doneTasks      = todayTasks.filter(t => t.status === 'done').length
  const blockedTasks   = todayTasks.filter(t => t.status === 'blocked').length
  const totalHours     = todayTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)

  const hasCheckin  = !!thisWeekScore
  const scoreAvg    = recentScores.length >= 4
    ? avg(recentScores.slice(-4).map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
    : null
  const prevAvg     = recentScores.length >= 8
    ? avg(recentScores.slice(-8, -4).map(s => avg([s.delivery, s.process, s.communication, s.growth, s.culture])))
    : null
  const scoreTrend  = scoreAvg && prevAvg ? scoreAvg - prevAvg : null

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

  const goalStatusOrder: Record<string, number> = { active: 0, achieved: 1, missed: 2 }
  const sortedGoals = [...myGoals].sort(
    (a, b) => (goalStatusOrder[a.status] ?? 9) - (goalStatusOrder[b.status] ?? 9)
      || a.progressPct - b.progressPct,
  )
  const activeGoals = sortedGoals.filter(g => g.status === 'active')
  const closedGoals = sortedGoals.filter(g => g.status !== 'active')

  return (
    <div className="w-full mx-auto pb-8">

      <MeDayHeader
        greeting={greeting}
        firstName={firstName}
        dateLabel={format(today, 'EEEE, d MMMM')}
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
      {missingYestEOD && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="text-sm font-semibold text-red-800">Yesterday&apos;s EOD report is missing</div>
            <div className="text-xs text-red-600 mt-0.5">
              You submitted a plan but never closed the day. Hours won&apos;t be logged until you do.
            </div>
          </div>
          <Link
            href={`/daily/eod?logId=${yesterdayLog?.id}`}
            className="flex-shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors"
          >
            Submit now →
          </Link>
        </div>
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
            <MePlanWidget />
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
                      <span className={`text-sm whitespace-pre-line block ${TASK_STATUS_CLS[task.status] ?? 'text-gray-800'}`}>
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

      {/* ── MY PROJECTS (Dev / Both) ──────────────────────────────────────── */}
      {isDev && myProjects.length > 0 && (
        <MeSection title="Your projects" icon="🚀" actionHref="/projects" actionLabel="All →">
          <div className="space-y-3">
            {myProjects.map(p => {
              const ci            = p.checkIns[0]
              // Calculate progress based on milestones
              const totalMilestones = p.milestones.length
              const completedMilestones = p.milestones.filter(m => m.status === 'done').length
              const calculatedProgress = totalMilestones > 0
                ? Math.round((completedMilestones / totalMilestones) * 100)
                : null
              // Find next upcoming milestone (not done)
              const milestone     = p.milestones.find(m => m.status !== 'done')
              const daysLeft      = milestone?.dueDate ? differenceInDays(new Date(milestone.dueDate), today) : null
              const isLate        = daysLeft !== null && daysLeft < 0
              const isUrgent      = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
              // Only show check-in button on Mondays OR if truly overdue (>7 days)
              const isMonday = today.getDay() === 1
              const projectCheckinThisWeek = ci ? isSameWeek(ci.weekOf, today) : false
              const projectCheckinOverdue = ci
                ? differenceInDays(today, new Date(ci.weekOf)) > 7
                : true
              const needsCheckin = !hasCheckin && !projectCheckinThisWeek && (isMonday || projectCheckinOverdue)
              const inQA          = p.status === 'qa'
              const signedOff     = !!p.releaseSignOff

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border ${
                    ci?.onTrack === 'no'       ? 'border-red-200 bg-red-50'
                    : ci?.onTrack === 'at_risk' ? 'border-amber-100 bg-amber-50'
                    : inQA                      ? 'border-blue-100 bg-blue-50'
                    : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <Link href={`/projects/${p.id}`} className="text-sm font-semibold text-gray-900 hover:underline">
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`badge text-xs ${
                          p.status === 'qa'     ? 'bg-teal-100 text-teal-800'
                          : p.status === 'active' ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-500'
                        }`}>{p.status}</span>
                        {signedOff && <QASignOffBadge signed />}
                        {ci?.onTrack === 'no'      && <span className="badge bg-red-100 text-red-800 text-xs">At risk</span>}
                        {ci?.onTrack === 'at_risk'  && <span className="badge bg-amber-100 text-amber-800 text-xs">Monitor</span>}
                      </div>
                    </div>
                    {/* Inline action prompts */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      {needsCheckin && (
                        <Link href="/checkin" className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200">
                          Check-in due →
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Progress + milestone */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    {calculatedProgress !== null && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              calculatedProgress >= 80 ? 'bg-green-500'
                              : calculatedProgress >= 50 ? 'bg-amber-400'
                              : calculatedProgress >= 25 ? 'bg-blue-500'
                              : 'bg-gray-400'
                            }`}
                            style={{ width: `${calculatedProgress}%` }}
                          />
                        </div>
                        <span>{calculatedProgress}%</span>
                      </div>
                    )}
                    {milestone && (
                      <span className={isLate ? 'text-red-600 font-medium' : isUrgent ? 'text-amber-700 font-medium' : ''}>
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
          </div>
        </MeSection>
      )}

      {/* ── MY PIPELINE (BD / Both) ───────────────────────────────────────── */}
      {isBD && myLeads.length > 0 && (
        <MeSection title="Your pipeline" icon="📈" actionHref="/pipeline" actionLabel="Full pipeline →">
          <div className="space-y-1.5">
            {myLeads.map(lead => {
              // Calculate staleness based on most recent meaningful activity
              // Use latest proposal date if available, otherwise use lead creation date
              const lastActivity = lead.proposals[0]?.sentAt || lead.createdAt
              const daysSince = differenceInDays(today, new Date(lastActivity))
              const stale     = daysSince >= 5
              const STATUS_LABEL: Record<string, string> = {
                new: 'New', proposal_sent: 'Proposal sent', interview: 'Interview',
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
                    <span className={`badge text-xs ${
                      lead.status === 'interview' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {STATUS_LABEL[lead.status as keyof typeof STATUS_LABEL] ?? lead.status}
                    </span>
                    {stale && (
                      <span className="text-xs text-amber-700">No update in {daysSince}d</span>
                    )}
                  </div>
                  <Link href={`/pipeline/${lead.id}`} className="text-xs text-gray-500 hover:text-gray-800 hover:underline">
                    View →
                  </Link>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {/* ── QA: PROJECTS NEEDING ATTENTION (QA only) ─────────────────────── */}
      {isQA && qaProjects.length > 0 && (
        <MeSection title="Projects needing QA" icon="🔍" actionHref="/qa" actionLabel="QA dashboard →">
          <div className="space-y-2">
            {qaProjects.map(p => {
              const cycle = p.testCycles[0]
              const signed = !!p.releaseSignOff
              const hasIssue = p.postDeliveryIssues.length > 0
              const milestoneProgress = projectMilestoneProgress(p.milestones)
              const cycleProgress = latestCycleProgress(cycle)
              const cycleFixSummary = cycle?.cases?.length ? testCycleCaseSummary(cycle.cases) : null

              let stateLabel: string, stateCls: string, action: string | null
              if (signed) {
                stateLabel = '✓ Signed off'; stateCls = 'bg-green-100 text-green-700'; action = null
              } else if (!cycle) {
                stateLabel = 'No test cycle'; stateCls = 'bg-gray-100 text-gray-500'; action = 'Start test cycle →'
              } else if (cycle.result === 'fail') {
                if (cycleFixSummary?.allFailuresFixed) {
                  stateLabel = 'Re-test needed'; stateCls = 'bg-teal-100 text-teal-800'; action = 'Re-test fixes →'
                } else {
                  stateLabel = 'Blocked'; stateCls = 'bg-red-100 text-red-700'; action = 'View blocker →'
                }
              } else if (cycle.result === 'pass' || cycle.result === 'conditional') {
                stateLabel = 'Ready to sign off'; stateCls = 'bg-amber-100 text-amber-800'; action = 'Submit sign-off →'
              } else {
                stateLabel = 'In progress'; stateCls = 'bg-blue-100 text-blue-800'; action = 'Continue →'
              }

              return (
                <div key={p.id} className="py-3 px-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Link href={`/qa/${p.id}`} className="text-sm font-medium text-gray-900 hover:underline">
                          {p.name}
                        </Link>
                        <span className={`badge text-xs ${stateCls}`}>{stateLabel}</span>
                        <span className="badge text-xs bg-blue-100 text-blue-800">{p.status}</span>
                        {hasIssue && <span className="badge bg-red-100 text-red-700 text-xs">Client issue open</span>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {milestoneProgress.total > 0 && (
                          <div className="rounded-md bg-white border border-gray-100 px-2.5 py-2">
                            <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                              <span className="font-medium text-gray-700">Milestones</span>
                              <span>{milestoneProgress.approved}/{milestoneProgress.total} approved</span>
                            </div>
                            <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-1">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${milestoneProgress.pct}%` }} />
                            </div>
                            <div className="text-[10px] text-gray-500 flex gap-2 flex-wrap">
                              {milestoneProgress.testing > 0 && (
                                <span className="text-teal-600">{milestoneProgress.testing} in testing</span>
                              )}
                              {milestoneProgress.totalCases > 0 && (
                                <span>
                                  {milestoneProgress.passedCases}/{milestoneProgress.totalCases} cases passed
                                  {milestoneProgress.failedCases > 0 && (
                                    <span className="text-red-600"> · {milestoneProgress.failedCases} failed</span>
                                  )}
                                </span>
                              )}
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
                              {cycleProgress.failing > 0 && (
                                <span className="text-red-600"> · {cycleProgress.failing} failing</span>
                              )}
                              {cycleProgress.awaitingRetest > 0 && (
                                <span className="text-amber-600"> · {cycleProgress.awaitingRetest} to re-test</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {action && (
                      <Link href={`/qa/${p.id}`} className="text-xs text-gray-500 hover:text-gray-800 hover:underline shrink-0 self-start">
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

      {/* ── OPEN BLOCKERS (Dev / Both / QA) ──────────────────────────────── */}
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
                  <span className={`flex-shrink-0 text-sm font-bold mt-0.5 ${ageDays >= 2 ? 'text-red-600' : 'text-amber-700'}`}>
                    {ageDays}d
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{b.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                      {b.project && <span>{b.project.name}</span>}
                      <span className="capitalize">{b.status.replace('_', ' ')}</span>
                      {b.escalatedToFounder && <span className="text-blue-600 font-medium">Escalated to Shiven ✓</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </MeSection>
      )}

      {/* ── GOALS ────────────────────────────────────────────────────────── */}
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
                  g.status === 'achieved' ? 'bg-green-50 border border-green-100'
                  : g.status === 'missed' ? 'bg-red-50 border border-red-100'
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
                    <span className={`text-sm font-semibold flex-shrink-0 ${
                      g.progressPct >= 80 ? 'text-green-700'
                      : g.progressPct >= 50 ? 'text-amber-700'
                      : 'text-red-500'
                    }`}>{g.progressPct}%</span>
                  )}
                </div>
                {g.status === 'active' && (
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        g.progressPct >= 80 ? 'bg-green-500'
                        : g.progressPct >= 50 ? 'bg-amber-400'
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

      {/* ── WEEKLY SCORE ─────────────────────────────────────────────────── */}
      <MeSection
        title="This week's score"
        icon="📊"
        headerActions={
          !hasCheckin ? (
            <Link href="/checkin" className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 shrink-0">
              Submit check-in →
            </Link>
          ) : undefined
        }
      >

        {!hasCheckin ? (
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

        {hasCheckin && thisWeekScore && (
          <div className="space-y-2.5">
            {(['delivery', 'process', 'communication', 'growth', 'culture'] as const).map(dim => {
              const val = thisWeekScore[dim] as number
              return (
                <div key={dim} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24 capitalize">{dim}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${val >= 8 ? 'bg-green-500' : val >= 6 ? 'bg-amber-400' : 'bg-red-400'}`}
                      style={{ width: `${val * 10}%` }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-5 text-right ${
                    val >= 8 ? 'text-green-700' : val >= 6 ? 'text-amber-700' : 'text-red-600'
                  }`}>{val}</span>
                </div>
              )
            })}
            {scoreAvg !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                <span>4-week avg: <strong className="text-gray-800">{scoreAvg.toFixed(1)}</strong></span>
                {scoreTrend !== null && (
                  <span className={scoreTrend > 0.1 ? 'text-green-600' : scoreTrend < -0.1 ? 'text-red-500' : 'text-gray-400'}>
                    {scoreTrend > 0.1 ? `▲ +${scoreTrend.toFixed(1)}` : scoreTrend < -0.1 ? `▼ ${scoreTrend.toFixed(1)}` : '→ Steady'}
                    {' '}vs prev 4 weeks
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </MeSection>

    </div>
  )
}
