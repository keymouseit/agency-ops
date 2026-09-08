import { prisma } from '@/lib/prisma'
import { businessDayStart, MAX_DAILY_PLAN_HOURS } from '@/lib/daily'
import { getEmployeeLeaveUsage } from '@/lib/leave-usage'
import { differenceInCalendarDays, eachDayOfInterval, format, isWeekend } from 'date-fns'

const DAY_TARGET = MAX_DAILY_PLAN_HOURS // 8h → 40h / week

export type EmployeeReportRange = {
  from: Date
  to: Date
}

function avg(nums: number[]) {
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

function scoreOverall(s: {
  delivery: number
  process: number
  communication: number
  growth: number
  culture: number
}) {
  return Math.round(((s.delivery + s.process + s.communication + s.growth + s.culture) / 5) * 10) / 10
}

/** Count weekdays in inclusive date range (approx business days). */
function countWeekdays(from: Date, to: Date) {
  return eachDayOfInterval({ start: from, end: to }).filter(d => !isWeekend(d)).length
}

export async function getEmployeeReport(memberId: string, range: EmployeeReportRange) {
  const from = businessDayStart(range.from)
  const toEnd = businessDayStart(range.to)
  // Inclusive end of day for weekOf / raisedAt queries
  const toExclusive = new Date(toEnd)
  toExclusive.setDate(toExclusive.getDate() + 1)

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, email: true, role: true, active: true },
  })
  if (!member) return null

  const today = businessDayStart()

  const [
    dailyLogs,
    scores,
    goals,
    projectsAsDev,
    projectsAsBd,
    blockers,
    projectCheckIns,
    leaveUsage,
    leaveBalance,
    qaCycles,
    qaFixes,
    qaRetests,
    overdueMilestones,
  ] = await Promise.all([
    prisma.dailyLog.findMany({
      where: {
        memberId,
        date: { gte: from, lte: toEnd },
      },
      include: {
        tasks: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.weeklyScore.findMany({
      where: {
        memberId,
        weekOf: { gte: from, lt: toExclusive },
      },
      orderBy: { weekOf: 'desc' },
    }),
    prisma.goal.findMany({
      where: { memberId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.project.findMany({
      where: { developerId: memberId },
      select: {
        id: true,
        name: true,
        status: true,
        estimatedHours: true,
        actualHours: true,
        estimatedEnd: true,
        clientName: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.project.findMany({
      where: { bdMemberId: memberId },
      select: {
        id: true,
        name: true,
        status: true,
        estimatedHours: true,
        actualHours: true,
        estimatedEnd: true,
        clientName: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.blocker.findMany({
      where: {
        memberId,
        OR: [
          { raisedAt: { gte: from, lt: toExclusive } },
          { status: { in: ['open', 'in_progress'] } },
        ],
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { raisedAt: 'desc' },
    }),
    prisma.projectCheckIn.findMany({
      where: {
        submittedById: memberId,
        weekOf: { gte: from, lt: toExclusive },
      },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { weekOf: 'desc' },
      take: 40,
    }),
    getEmployeeLeaveUsage(memberId, from, toEnd),
    prisma.leaveBalance.findFirst({
      where: { memberId, year: from.getFullYear() },
      select: {
        year: true,
        accrued: true,
        used: true,
        shortLeaves: true,
      },
    }),
    prisma.testCycle.findMany({
      where: {
        conductedById: memberId,
        startedAt: { gte: from, lt: toExclusive },
      },
      select: {
        id: true,
        cycleType: true,
        result: true,
        startedAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 30,
    }),
    prisma.testCycleCase.findMany({
      where: {
        devFixedById: memberId,
        devFixedAt: { gte: from, lt: toExclusive },
      },
      select: {
        id: true,
        title: true,
        status: true,
        devFixedAt: true,
        testCycle: { select: { project: { select: { name: true } } } },
      },
      orderBy: { devFixedAt: 'desc' },
      take: 30,
    }),
    prisma.testCycleCase.findMany({
      where: {
        qaRetestedById: memberId,
        qaRetestedAt: { gte: from, lt: toExclusive },
      },
      select: {
        id: true,
        title: true,
        status: true,
        qaRetestedAt: true,
        testCycle: { select: { project: { select: { name: true } } } },
      },
      orderBy: { qaRetestedAt: 'desc' },
      take: 30,
    }),
    prisma.milestone.findMany({
      where: {
        status: { not: 'done' },
        dueDate: { lt: today },
        project: {
          status: { notIn: ['delivered', 'cancelled'] },
          OR: [{ developerId: memberId }, { bdMemberId: memberId }],
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
  ])

  const expectedBusinessDays = countWeekdays(from, toEnd)
  const plannedDays = dailyLogs.filter(l => l.planSubmittedAt).length
  const eodDays = dailyLogs.filter(l => l.eodSubmittedAt).length
  const planMissed = dailyLogs.filter(l => l.planMissed || (!l.planSubmittedAt && l.date < businessDayStart())).length
  const eodMissed = dailyLogs.filter(l => l.eodMissed || (l.planSubmittedAt && !l.eodSubmittedAt && l.date < businessDayStart())).length

  const allTasks = dailyLogs.flatMap(l => l.tasks)
  const hoursLogged = allTasks.reduce((s, t) => s + (t.actualHours ?? 0), 0)
  const hoursEstimated = allTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const tasksByStatus = {
    done: allTasks.filter(t => t.status === 'done').length,
    partial: allTasks.filter(t => t.status === 'partial').length,
    blocked: allTasks.filter(t => t.status === 'blocked').length,
    moved: allTasks.filter(t => t.status === 'moved').length,
    skipped: allTasks.filter(t => t.status === 'skipped').length,
    planned: allTasks.filter(t => t.status === 'planned').length,
    total: allTasks.length,
  }

  const dayRatings = dailyLogs.map(l => l.dayRating).filter((n): n is number => n != null)
  const completionRates = dailyLogs.map(l => l.completionRate).filter((n): n is number => n != null)

  const selfScores = scores.filter(s => !s.founderScore)
  const founderScores = scores.filter(s => s.founderScore)

  const openBlockers = blockers.filter(b => b.status === 'open' || b.status === 'in_progress')
  const rangeDays = Math.max(1, differenceInCalendarDays(toEnd, from) + 1)

  const logsByDate = new Map(
    dailyLogs.map(l => [format(l.date, 'yyyy-MM-dd'), l])
  )

  const weekdayKeys = eachDayOfInterval({ start: from, end: toEnd })
    .filter(d => !isWeekend(d))
    .map(d => format(d, 'yyyy-MM-dd'))

  const hoursByDay = weekdayKeys.map(dateKey => {
    const log = logsByDate.get(dateKey)
    const dayDate = businessDayStart(dateKey)
    const isPast = dayDate < today
    const isToday = dayDate.getTime() === today.getTime()

    // Adjust target for approved leave covering this day
    let dayTarget = DAY_TARGET
    for (const leave of leaveUsage.leaves) {
      const start = leave.startDate.slice(0, 10)
      const end = leave.endDate.slice(0, 10)
      if (dateKey < start || dateKey > end) continue
      if (leave.leaveType === 'full_day') dayTarget = 0
      else if (leave.leaveType === 'half_day') dayTarget = 4
      else if (leave.leaveType === 'short_leave') dayTarget = Math.max(0, DAY_TARGET - 2)
    }

    const planned = log
      ? Math.round(log.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0) * 10) / 10
      : 0
    const logged = log
      ? Math.round(log.tasks.reduce((s, t) => s + (t.actualHours ?? 0), 0) * 10) / 10
      : 0
    const hasPlan = Boolean(log?.planSubmittedAt)
    const hasEod = Boolean(log?.eodSubmittedAt)

    const phase: 'past' | 'today' | 'future' = isToday ? 'today' : isPast ? 'past' : 'future'

    const plannedShort =
      phase !== 'future' && dayTarget > 0
        ? Math.max(0, Math.round((dayTarget - planned) * 10) / 10)
        : 0
    // Only closed days count as missing. Today is still in progress.
    const loggedShort =
      phase === 'past' && dayTarget > 0
        ? Math.max(0, Math.round((dayTarget - logged) * 10) / 10)
        : 0

    const flags: string[] = []
    if (dayTarget === 0) flags.push('on_leave')
    else if (phase === 'future') flags.push('upcoming')
    else if (phase === 'today') flags.push(hasPlan ? 'today' : 'today_no_plan')
    else if (!hasPlan) flags.push('no_plan')
    else if (loggedShort >= 1) flags.push('under_logged')
    else if (!hasEod) flags.push('no_eod')
    else if (plannedShort >= 1) flags.push('under_planned')

    return {
      date: dayDate.toISOString(),
      expected: dayTarget,
      planned,
      logged,
      plannedShort,
      loggedShort,
      hasPlan,
      hasEod,
      isPast,
      isToday,
      phase,
      flags,
      taskCount: log?.tasks.length ?? 0,
    }
  })

  const expectedHours =
    Math.round(hoursByDay.reduce((s, d) => s + d.expected, 0) * 10) / 10
  const expectedElapsed =
    Math.round(
      hoursByDay.filter(d => d.phase === 'past').reduce((s, d) => s + d.expected, 0) * 10
    ) / 10
  const plannedShortTotal =
    Math.round(hoursByDay.reduce((s, d) => s + d.plannedShort, 0) * 10) / 10
  const loggedShortTotal =
    Math.round(hoursByDay.reduce((s, d) => s + d.loggedShort, 0) * 10) / 10
  const utilisationPct =
    expectedElapsed > 0 ? Math.round((hoursLogged / expectedElapsed) * 100) : null

  return {
    member,
    range: {
      from: from.toISOString(),
      to: toEnd.toISOString(),
      days: rangeDays,
      expectedBusinessDays,
    },
    hours: {
      dayTarget: DAY_TARGET,
      expected: expectedHours,
      expectedElapsed,
      planned: Math.round(hoursEstimated * 10) / 10,
      logged: Math.round(hoursLogged * 10) / 10,
      plannedShort: plannedShortTotal,
      loggedShort: loggedShortTotal,
      utilisationPct,
      byDay: hoursByDay,
    },
    snapshot: {
      planRate:
        expectedBusinessDays > 0
          ? Math.round(
              (plannedDays /
                Math.max(
                  1,
                  hoursByDay.filter(d => d.phase === 'past' && d.expected > 0).length
                )) *
                100
            )
          : null,
      eodRate: plannedDays > 0 ? Math.round((eodDays / plannedDays) * 100) : null,
      plannedDays,
      eodDays,
      planMissed,
      eodMissed,
      avgDayRating: avg(dayRatings),
      avgCompletionRate:
        completionRates.length > 0
          ? Math.round((completionRates.reduce((a, b) => a + b, 0) / completionRates.length) * 100)
          : null,
      hoursLogged: Math.round(hoursLogged * 10) / 10,
      hoursEstimated: Math.round(hoursEstimated * 10) / 10,
      expectedHours: expectedElapsed,
      hoursShort: loggedShortTotal,
      utilisationPct,
      avgSelfScore: avg(selfScores.map(scoreOverall)),
      avgFounderScore: avg(founderScores.map(scoreOverall)),
      openBlockers: openBlockers.length,
      leaveDaysUsed: leaveUsage.totalDayBalance,
      activeGoals: goals.filter(g => g.status === 'active').length,
    },
    tasksByStatus,
    projectActivity: (() => {
      type Bucket = {
        projectId: string | null
        projectName: string
        hoursLogged: number
        hoursPlanned: number
        done: number
        partial: number
        blocked: number
        moved: number
        skipped: number
        planned: number
        total: number
        tasks: { id: string; title: string; status: string; hours: number }[]
      }
      const map = new Map<string, Bucket>()

      for (const log of dailyLogs) {
        for (const t of log.tasks) {
          const key = t.project?.id ?? '__none__'
          let b = map.get(key)
          if (!b) {
            b = {
              projectId: t.project?.id ?? null,
              projectName: t.project?.name ?? 'No project',
              hoursLogged: 0,
              hoursPlanned: 0,
              done: 0,
              partial: 0,
              blocked: 0,
              moved: 0,
              skipped: 0,
              planned: 0,
              total: 0,
              tasks: [],
            }
            map.set(key, b)
          }
          b.hoursLogged += t.actualHours ?? 0
          b.hoursPlanned += t.estimatedHours ?? 0
          b.total += 1
          if (t.status === 'done') b.done += 1
          else if (t.status === 'partial') b.partial += 1
          else if (t.status === 'blocked') b.blocked += 1
          else if (t.status === 'moved') b.moved += 1
          else if (t.status === 'skipped') b.skipped += 1
          else b.planned += 1
          b.tasks.push({
            id: t.id,
            title: t.title,
            status: t.status,
            hours: t.actualHours ?? t.estimatedHours ?? 0,
          })
        }
      }

      const rows = [...map.values()].map(b => ({
        ...b,
        hoursLogged: Math.round(b.hoursLogged * 10) / 10,
        hoursPlanned: Math.round(b.hoursPlanned * 10) / 10,
        sharePct:
          hoursLogged > 0
            ? Math.round((b.hoursLogged / hoursLogged) * 100)
            : hoursEstimated > 0
              ? Math.round((b.hoursPlanned / hoursEstimated) * 100)
              : 0,
        inProgress: b.partial,
      }))

      return rows.sort((a, b) => b.hoursLogged - a.hoursLogged || b.hoursPlanned - a.hoursPlanned)
    })(),
    dailyLogs: dailyLogs.map(l => {
      const planned = Math.round(l.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0) * 10) / 10
      const logged = Math.round(l.tasks.reduce((s, t) => s + (t.actualHours ?? 0), 0) * 10) / 10
      return {
        id: l.id,
        date: l.date.toISOString(),
        planSubmittedAt: l.planSubmittedAt?.toISOString() ?? null,
        eodSubmittedAt: l.eodSubmittedAt?.toISOString() ?? null,
        planMissed: l.planMissed,
        eodMissed: l.eodMissed,
        dayRating: l.dayRating,
        completionRate: l.completionRate,
        blockers: l.blockers,
        carryOver: l.carryOver,
        eodNotes: l.eodNotes,
        hoursPlanned: planned,
        hoursLogged: logged,
        tasks: l.tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          estimatedHours: t.estimatedHours,
          actualHours: t.actualHours,
          eodNotes: t.eodNotes,
          blockedReason: t.blockedReason,
          project: t.project,
        })),
      }
    }),
    scores: {
      self: selfScores.map(s => ({
        id: s.id,
        weekOf: s.weekOf.toISOString(),
        delivery: s.delivery,
        process: s.process,
        communication: s.communication,
        growth: s.growth,
        culture: s.culture,
        overall: scoreOverall(s),
        selfNotes: s.selfNotes,
        repeatedMistake: s.repeatedMistake,
      })),
      founder: founderScores.map(s => ({
        id: s.id,
        weekOf: s.weekOf.toISOString(),
        delivery: s.delivery,
        process: s.process,
        communication: s.communication,
        growth: s.growth,
        culture: s.culture,
        overall: scoreOverall(s),
        selfNotes: s.selfNotes,
        repeatedMistake: s.repeatedMistake,
      })),
    },
    goals: goals.map(g => ({
      id: g.id,
      title: g.title,
      category: g.category,
      quarter: g.quarter,
      progressPct: g.progressPct,
      status: g.status,
      successMetric: g.successMetric,
      targetDate: g.targetDate?.toISOString() ?? null,
    })),
    projects: {
      asDev: projectsAsDev,
      asBd: projectsAsBd,
    },
    blockers: blockers.map(b => ({
      id: b.id,
      description: b.description,
      category: b.category,
      status: b.status,
      raisedAt: b.raisedAt.toISOString(),
      resolvedAt: b.resolvedAt?.toISOString() ?? null,
      escalatedToFounder: b.escalatedToFounder,
      project: b.project,
    })),
    projectCheckIns: projectCheckIns.map(c => ({
      id: c.id,
      weekOf: c.weekOf.toISOString(),
      progressPct: c.progressPct,
      onTrack: c.onTrack,
      blockers: c.blockers,
      project: c.project,
    })),
    leaves: leaveUsage,
    leaveBalance,
    issues: (() => {
      const closed = new Set(['delivered', 'cancelled'])
      const seenProjects = new Set<string>()
      const rows: {
        kind: 'deadline' | 'blunder' | 'at_risk'
        title: string
        detail: string
        date: string | null
        href: string | null
      }[] = []

      for (const p of [...projectsAsDev, ...projectsAsBd]) {
        if (seenProjects.has(p.id) || !p.estimatedEnd || closed.has(p.status)) continue
        seenProjects.add(p.id)
        if (p.estimatedEnd < today) {
          const days = differenceInCalendarDays(today, p.estimatedEnd)
          rows.push({
            kind: 'deadline',
            title: `Missed project deadline: ${p.name}`,
            detail: `Due ${format(p.estimatedEnd, 'MMM d, yyyy')} · ${days} day${days === 1 ? '' : 's'} late`,
            date: p.estimatedEnd.toISOString(),
            href: `/projects/${p.id}`,
          })
        }
      }

      for (const m of overdueMilestones) {
        const days = differenceInCalendarDays(today, m.dueDate)
        rows.push({
          kind: 'deadline',
          title: `Missed milestone: ${m.title}`,
          detail: `${m.project.name} · due ${format(m.dueDate, 'MMM d')} · ${days}d late`,
          date: m.dueDate.toISOString(),
          href: `/projects/${m.project.id}`,
        })
      }

      for (const s of scores.filter(sc => sc.repeatedMistake)) {
        rows.push({
          kind: 'blunder',
          title: s.founderScore
            ? 'Founder flagged a repeated mistake'
            : 'Repeated mistake on weekly check-in',
          detail: s.selfNotes?.trim() || `Week of ${format(s.weekOf, 'MMM d')}`,
          date: s.weekOf.toISOString(),
          href: '/team',
        })
      }

      for (const c of projectCheckIns) {
        if (c.onTrack !== 'no' && c.onTrack !== 'at_risk') continue
        rows.push({
          kind: 'at_risk',
          title:
            c.onTrack === 'no'
              ? `Delivery late: ${c.project.name}`
              : `At risk: ${c.project.name}`,
          detail:
            c.blockers?.trim() ||
            `Check-in week of ${format(c.weekOf, 'MMM d')} · ${c.progressPct}%`,
          date: c.weekOf.toISOString(),
          href: `/projects/${c.project.id}`,
        })
      }

      for (const g of goals.filter(gl => gl.status === 'missed')) {
        rows.push({
          kind: 'deadline',
          title: `Missed goal: ${g.title}`,
          detail: g.quarter,
          date: g.targetDate?.toISOString() ?? null,
          href: '/goals',
        })
      }

      return rows
    })(),
    qa: {
      cyclesConducted: qaCycles.map(c => ({
        id: c.id,
        cycleType: c.cycleType,
        result: c.result,
        startedAt: c.startedAt.toISOString(),
        project: c.project,
      })),
      fixesSubmitted: qaFixes.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        at: c.devFixedAt?.toISOString() ?? null,
        projectName: c.testCycle.project.name,
      })),
      retestsDone: qaRetests.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        at: c.qaRetestedAt?.toISOString() ?? null,
        projectName: c.testCycle.project.name,
      })),
    },
  }
}

export type EmployeeReport = NonNullable<Awaited<ReturnType<typeof getEmployeeReport>>>
