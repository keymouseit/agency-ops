import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { startOfDay, startOfWeek, subDays, differenceInDays, format, isWeekend } from 'date-fns'
import Link from 'next/link'
import { fmtDate, avg } from '@/lib/utils'
import MePlanWidget from './MePlanWidget'

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
  const role     = session.user.role as 'Dev' | 'BD' | 'QA' | 'Both'
  const today    = startOfDay(new Date())
  const thisWeek = startOfWeek(new Date())
  const isWeekday = !isWeekend(today)

  const isDev = role === 'Dev' || role === 'Both'
  const isBD  = role === 'BD'  || role === 'Both'
  const isQA  = role === 'QA'

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
            milestones:     { where: { status: { not: 'done' } }, orderBy: { dueDate: 'asc' }, take: 1 },
            checkIns:       { orderBy: { weekOf: 'desc' }, take: 1 },
            testCycles:     { orderBy: { startedAt: 'desc' }, take: 1 },
            releaseSignOff: true,
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

    // My active goals — everyone
    prisma.goal.findMany({
      where: { memberId, status: 'active' },
      orderBy: { progressPct: 'asc' }, // lowest progress first = most urgent
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
            testCycles:         { orderBy: { startedAt: 'desc' }, take: 1 },
            releaseSignOff:     true,
            postDeliveryIssues: { where: { resolvedAt: null }, take: 1 },
          },
          orderBy: { updatedAt: 'desc' },
        })
      : Promise.resolve([]),
  ])

  if (!member) redirect('/login')

  // ── Derived state ─────────────────────────────────────────────────────────
  const hasPlan        = !!todayLog?.planSubmittedAt
  const hasEOD         = !!todayLog?.eodSubmittedAt
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
  const hour      = new Date().getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

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
    <div className="max-w-3xl mx-auto">

      {/* Greeting */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-gray-900">{greeting}, {firstName}.</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(today, 'EEEE, d MMMM')}
        </p>
      </div>

      {/* ── URGENT: Missing yesterday's EOD ─────────────────────────────── */}
      {missingYestEOD && (
        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4">
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

      {/* ── TODAY ────────────────────────────────────────────────────────── */}
      {isWeekday && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Today</h2>
            {hasPlan && !hasEOD && (
              <Link
                href={`/daily/eod?logId=${todayLog?.id}`}
                className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700"
              >
                Submit EOD →
              </Link>
            )}
          </div>

          {!hasPlan ? (
            <MePlanWidget />
          ) : (
            <div>
              {/* Summary strip */}
              <div className="flex gap-6 mb-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Planned</div>
                  <div className="font-semibold text-gray-900">{todayTasks.length} tasks · {totalHours}h</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Done</div>
                  <div className={`font-semibold ${doneTasks === todayTasks.length && todayTasks.length > 0 ? 'text-green-700' : 'text-gray-900'}`}>
                    {doneTasks} / {todayTasks.length}
                  </div>
                </div>
                {blockedTasks > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Blocked</div>
                    <div className="font-semibold text-red-600">{blockedTasks}</div>
                  </div>
                )}
                {hasEOD && (
                  <div className="ml-auto self-center">
                    <span className="text-xs text-green-600 font-medium">✓ EOD done</span>
                  </div>
                )}
              </div>

              {/* Task list */}
              <div className="space-y-0">
                {todayTasks.map(task => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`} />
                    <span className={`flex-1 text-sm ${TASK_STATUS_CLS[task.status] ?? 'text-gray-800'}`}>
                      {task.title}
                    </span>
                    {task.project && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{task.project.name}</span>
                    )}
                    {task.status !== 'planned' && (
                      <span className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded font-medium ${
                        task.status === 'done'    ? 'bg-green-100 text-green-700'
                        : task.status === 'blocked' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                      }`}>
                        {task.status}
                      </span>
                    )}
                    {task.estimatedHours && (
                      <span className="text-xs text-gray-300 flex-shrink-0">{task.estimatedHours}h</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ESTIMATION TASKS (Dev / Both) ────────────────────────────────── */}
      {/* Dev sees: what they need to fill out. No BD context, no lead status, no pipeline. */}
      {isDev && devEstimates.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Estimates you need to fill</h2>
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
        </div>
      )}

      {/* ── ESTIMATES TO REVIEW (BD / Both) ──────────────────────────────── */}
      {/* BD sees: estimates confirmed by dev, waiting for their approval. */}
      {isBD && bdEstimates.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Estimates ready for your review</h2>
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
        </div>
      )}

      {/* ── MY PROJECTS (Dev / Both) ──────────────────────────────────────── */}
      {isDev && myProjects.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Your projects</h2>
            <Link href="/projects" className="text-xs text-gray-400 hover:text-gray-600">All →</Link>
          </div>
          <div className="space-y-3">
            {myProjects.map(p => {
              const ci            = p.checkIns[0]
              const milestone     = p.milestones[0]
              const daysLeft      = milestone?.dueDate ? differenceInDays(new Date(milestone.dueDate), today) : null
              const isLate        = daysLeft !== null && daysLeft < 0
              const isUrgent      = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
              const needsCheckin  = !ci || differenceInDays(today, new Date(ci.weekOf)) > 7
              const inQA          = p.status === 'qa'
              const needsSignOff  = inQA && !p.releaseSignOff && p.testCycles[0]?.result === 'pass'
              const needsCycle    = inQA && !p.releaseSignOff && !p.testCycles[0]

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
                      {needsCycle && (
                        <Link href={`/qa/${p.id}`} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">
                          Log test cycle →
                        </Link>
                      )}
                      {needsSignOff && (
                        <Link href={`/qa/${p.id}`} className="text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded hover:bg-green-200">
                          Submit sign-off →
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Progress + milestone */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                    {ci?.progressPct !== undefined && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ci.onTrack === 'no'       ? 'bg-red-400'
                              : ci.onTrack === 'at_risk' ? 'bg-amber-400'
                              : 'bg-green-400'
                            }`}
                            style={{ width: `${ci.progressPct}%` }}
                          />
                        </div>
                        <span>{ci.progressPct}%</span>
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
        </div>
      )}

      {/* ── MY PIPELINE (BD / Both) ───────────────────────────────────────── */}
      {isBD && myLeads.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Your pipeline</h2>
            <Link href="/pipeline" className="text-xs text-gray-400 hover:text-gray-600">Full pipeline →</Link>
          </div>
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
        </div>
      )}

      {/* ── QA: PROJECTS NEEDING ATTENTION (QA only) ─────────────────────── */}
      {isQA && qaProjects.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Projects needing QA</h2>
            <Link href="/qa" className="text-xs text-gray-400 hover:text-gray-600">QA dashboard →</Link>
          </div>
          <div className="space-y-1.5">
            {qaProjects.map(p => {
              const cycle    = p.testCycles[0]
              const signed   = !!p.releaseSignOff
              const hasIssue = p.postDeliveryIssues.length > 0

              let stateLabel: string, stateCls: string, action: string | null
              if (signed) {
                stateLabel = '✓ Signed off'; stateCls = 'bg-green-100 text-green-700'; action = null
              } else if (!cycle) {
                stateLabel = 'No test cycle'; stateCls = 'bg-gray-100 text-gray-500'; action = 'Start test cycle →'
              } else if (cycle.result === 'fail') {
                stateLabel = 'Blocked'; stateCls = 'bg-red-100 text-red-700'; action = 'View blocker →'
              } else if (cycle.result === 'pass' || cycle.result === 'conditional') {
                stateLabel = 'Ready to sign off'; stateCls = 'bg-amber-100 text-amber-800'; action = 'Submit sign-off →'
              } else {
                stateLabel = 'In progress'; stateCls = 'bg-blue-100 text-blue-800'; action = 'Continue →'
              }

              return (
                <div key={p.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    <span className={`badge text-xs ${stateCls}`}>{stateLabel}</span>
                    {hasIssue && <span className="badge bg-red-100 text-red-700 text-xs">Client issue open</span>}
                  </div>
                  {action && (
                    <Link href={`/qa/${p.id}`} className="text-xs text-gray-500 hover:text-gray-800 hover:underline ml-3 flex-shrink-0">
                      {action}
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── OPEN BLOCKERS (Dev / Both / QA) ──────────────────────────────── */}
      {myOpenBlockers.length > 0 && (
        <div className="card p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Your open blockers</h2>
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
        </div>
      )}

      {/* ── GOALS ────────────────────────────────────────────────────────── */}
      {myGoals.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Your goals this quarter</h2>
            <Link href="/goals" className="text-xs text-gray-400 hover:text-gray-600">All →</Link>
          </div>
          <div className="space-y-3">
            {myGoals.map(g => (
              <div key={g.id}>
                <div className="flex justify-between items-baseline text-sm mb-1">
                  <span className="text-gray-800">{g.title}</span>
                  <span className={`font-semibold flex-shrink-0 ml-3 ${
                    g.progressPct >= 80 ? 'text-green-700'
                    : g.progressPct >= 50 ? 'text-amber-700'
                    : 'text-red-500'
                  }`}>{g.progressPct}%</span>
                </div>
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
                {g.successMetric && (
                  <p className="text-xs text-gray-400 mt-0.5">Done when: {g.successMetric}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WEEKLY SCORE ─────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">This week&apos;s score</h2>
          {!hasCheckin && (
            <Link href="/checkin" className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700">
              Submit check-in →
            </Link>
          )}
        </div>

        {!hasCheckin ? (
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-sm text-amber-800 font-medium">Weekly check-in not submitted yet.</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Covers your project status and your self-score for the week.
            </p>
          </div>
        ) : (
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
      </div>

    </div>
  )
}
