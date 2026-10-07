import { prisma } from '@/lib/prisma'
import { assignedToMemberWhere } from '@/lib/project-assignees'
import { businessDayKey, businessDayStart } from '@/lib/daily'
import { getEmployeeLeaveUsage } from '@/lib/leave-usage'
import { computeExpectedHoursForDay, STANDARD_DAY_HOURS } from '@/lib/expected-hours'
import { getHolidayName, isHoliday } from '@/lib/holidays'
import { milestoneListOrderBy } from '@/lib/project-queries'
import { MILESTONE_STATUS_CONFIG } from '@/lib/milestone-qa'
import { differenceInCalendarDays } from 'date-fns'
import { formatIstDate, formatIst } from '@/lib/ist'

const DAY_TARGET = STANDARD_DAY_HOURS // 8h → 40h / week (leave-adjusted per day below)

function istWeekdayShort(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(date)
}

/** Weekday YYYY-MM-DD keys in IST (not the server's local timezone). */
function eachWeekdayKeys(from: Date, to: Date) {
  const keys: string[] = []
  let key = businessDayKey(from)
  const end = businessDayKey(to)
  while (key <= end) {
    const start = businessDayStart(key)
    const wd = istWeekdayShort(start)
    if (wd !== 'Sat' && wd !== 'Sun') keys.push(key)
    key = businessDayKey(new Date(start.getTime() + 36 * 60 * 60 * 1000))
  }
  return keys
}

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

/** Same weights as the Individual report overall performance score (client overallScore). */
export function computePerformanceScore(input: {
  hoursLogged: number
  hoursExpected: number
  planRate: number | null
  eodRate: number | null
  completionRate: number | null
  avgSelfScore: number | null
}) {
  const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n))
  const hoursPct =
    input.hoursExpected > 0
      ? clamp((input.hoursLogged / input.hoursExpected) * 100)
      : 70
  const planPct = input.planRate ?? 50
  const eodPct = input.eodRate ?? 50
  const completion = input.completionRate ?? 50
  const self = input.avgSelfScore != null ? input.avgSelfScore * 10 : 70
  return Math.round(hoursPct * 0.3 + planPct * 0.2 + eodPct * 0.2 + completion * 0.15 + self * 0.15)
}


function leaveBadgeForDay(leaveType: string | null, holidayName: string | null): string | null {
  if (holidayName) return 'Holiday'
  if (!leaveType) return null
  if (leaveType === 'short_leave') return 'Short leave'
  if (leaveType === 'half_day') return 'Half day'
  if (leaveType === 'birthday_leave') return 'Birthday leave'
  if (leaveType === 'comp_off_leave') return 'Comp Off leave'
  if (leaveType === 'work_from_home') return 'WFH'
  return 'Full day leave'
}

/** Mon–Sun week buckets clipped to [from, to] (IST business-day keys). */
function eachClippedWeeks(from: Date, to: Date) {
  const fromKey = businessDayKey(from)
  const toKey = businessDayKey(to)
  const weeks: { startKey: string; endKey: string; label: string }[] = []

  // Walk back to Monday of the week containing `from`
  let cursor = businessDayStart(from)
  for (let i = 0; i < 7; i++) {
    if (istWeekdayShort(cursor) === 'Mon') break
    cursor = businessDayStart(new Date(cursor.getTime() - 36 * 60 * 60 * 1000))
  }

  while (businessDayKey(cursor) <= toKey) {
    const weekStart = cursor
    const weekEnd = businessDayStart(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000))
    const startKey = businessDayKey(weekStart) < fromKey ? fromKey : businessDayKey(weekStart)
    const endKey = businessDayKey(weekEnd) > toKey ? toKey : businessDayKey(weekEnd)
    if (startKey <= endKey) {
      const anchor = formatIst(businessDayStart(startKey), { day: 'numeric', month: 'short' })
      const rangeLabel = `${formatIst(businessDayStart(startKey), { day: 'numeric', month: 'short' })}–${formatIst(businessDayStart(endKey), { day: 'numeric', month: 'short' })}`
      weeks.push({
        startKey,
        endKey,
        label: `Week of ${anchor} (${rangeLabel})`,
      })
    }
    cursor = businessDayStart(new Date(weekEnd.getTime() + 36 * 60 * 60 * 1000))
  }
  return weeks
}

type MilestoneChip = 'approved' | 'needs_attention' | 'delayed' | 'upcoming'

function classifyMilestone(
  m: { status: string; dueDate: Date | null; title: string },
  today: Date,
): {
  chip: MilestoneChip
  label: string
  daysLate: number | null
  dueDate: string | null
} {
  const due = m.dueDate
  const daysLate =
    due && m.status !== 'done' && due < today
      ? differenceInCalendarDays(today, due)
      : null
  const overdue = daysLate != null && daysLate > 0

  let chip: MilestoneChip
  let label: string
  if (m.status === 'done') {
    chip = 'approved'
    label = MILESTONE_STATUS_CONFIG.done?.label ?? 'Approved'
  } else if (overdue) {
    chip = 'delayed'
    label = 'Delayed'
  } else if (m.status === 'ready_for_qa' || m.status === 'testing') {
    chip = 'needs_attention'
    label =
      m.status === 'testing'
        ? 'Needs attention · QA'
        : 'Needs attention · pending approval'
  } else {
    chip = 'upcoming'
    label =
      MILESTONE_STATUS_CONFIG[m.status]?.label ??
      (m.status === 'in_progress' ? 'In progress' : 'Upcoming')
  }

  return {
    chip,
    label,
    daysLate,
    dueDate: due ? due.toISOString() : null,
  }
}

/** Count weekdays in inclusive date range (IST business days). */
function countWeekdays(from: Date, to: Date) {
  return eachWeekdayKeys(from, to).length
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
    projectMilestones,
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
      where: assignedToMemberWhere(memberId),
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
        project: {
          status: { notIn: ['delivered', 'cancelled'] },
          OR: [
            { developerId: memberId },
            { bdMemberId: memberId },
            { assignees: { some: { memberId } } },
          ],
        },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        completedAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: milestoneListOrderBy,
      take: 200,
    }),
  ])

  // Placeholder — recomputed from leave/holiday-adjusted hoursByDay below.
  let expectedBusinessDays = countWeekdays(from, toEnd)
  const plannedDays = dailyLogs.filter(l => l.planSubmittedAt).length
  const eodDays = dailyLogs.filter(
    l => l.eodSubmittedAt || l.tasks.some(t => t.status !== 'planned')
  ).length
  const planMissed = dailyLogs.filter(l => l.planMissed || (!l.planSubmittedAt && l.date < businessDayStart())).length
  const eodMissed = dailyLogs.filter(l => {
    const done = l.eodSubmittedAt || l.tasks.some(t => t.status !== 'planned')
    return l.eodMissed || (l.planSubmittedAt && !done && l.date < businessDayStart())
  }).length

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
    dailyLogs.map(l => [businessDayKey(l.date), l])
  )

  const weekdayKeys = eachWeekdayKeys(from, toEnd)

  const hoursByDay = weekdayKeys.map(dateKey => {
    const log = logsByDate.get(dateKey)
    const dayDate = businessDayStart(dateKey)
    const isPast = dayDate < today
    const isToday = dayDate.getTime() === today.getTime()
    const holidayName = getHolidayName(dateKey)
    const dayIsHoliday = isHoliday(dateKey)

    // Leave-adjusted target (approved leave only; leaveUsage is already filtered).
    // Holidays: expected 0 — excluded like weekends from missing/plan denominators.
    const expectedDay = dayIsHoliday
      ? {
          expectedHours: 0,
          leaveType: null as string | null,
          leaveHint: holidayName ? `Holiday · ${holidayName}` : 'Holiday',
          isFullDayLeave: false,
        }
      : computeExpectedHoursForDay(dateKey, leaveUsage.leaves)
    const dayTarget = expectedDay.expectedHours

    const planned = log
      ? Math.round(log.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0) * 10) / 10
      : 0
    const logged = log
      ? Math.round(log.tasks.reduce((s, t) => s + (t.actualHours ?? 0), 0) * 10) / 10
      : 0
    const hasPlan = Boolean(log?.planSubmittedAt)
    const hasEod =
      Boolean(log?.eodSubmittedAt) ||
      Boolean(log && log.tasks.some(t => t.status !== 'planned'))

    const phase: 'past' | 'today' | 'future' = isToday ? 'today' : isPast ? 'past' : 'future'

    const plannedShort =
      phase !== 'future' && dayTarget > 0
        ? Math.max(0, Math.round((dayTarget - planned) * 10) / 10)
        : 0
    // Only closed days count as missing. Today is still in progress.
    // Full-day leave / holiday (dayTarget 0) never contribute missing hours.
    const loggedShort =
      phase === 'past' && dayTarget > 0
        ? Math.max(0, Math.round((dayTarget - logged) * 10) / 10)
        : 0

    const flags: string[] = []
    if (dayIsHoliday) flags.push('holiday')
    else if (dayTarget === 0) flags.push('on_leave')
    else if (phase === 'future') flags.push('upcoming')
    else if (phase === 'today') flags.push(hasPlan ? 'today' : 'today_no_plan')
    else if (!hasPlan) flags.push('no_plan')
    else if (loggedShort >= 1) flags.push('under_logged')
    else if (!hasEod) flags.push('no_eod')
    else if (plannedShort >= 1) flags.push('under_planned')

    const leaveBadge = leaveBadgeForDay(
      dayIsHoliday ? null : expectedDay.leaveType,
      holidayName,
    )

    return {
      date: dayDate.toISOString(),
      dateKey,
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
      leaveType: dayIsHoliday ? null : expectedDay.leaveType,
      leaveHint: expectedDay.leaveHint,
      leaveBadge,
      isHoliday: dayIsHoliday,
      holidayName,
      isFullDayLeave: !dayIsHoliday && dayTarget === 0,
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

  // Working days that still expect hours (excludes weekends, holidays, full-day leave).
  expectedBusinessDays = hoursByDay.filter(d => d.expected > 0).length

  const weekByWeek = (() => {
    const weeksMeta = eachClippedWeeks(from, toEnd)
    const rangeStartKey = businessDayKey(from)
    const rangeEndKey = businessDayKey(toEnd)
    const selfByWeekKey = new Map(
      selfScores.map(s => [businessDayKey(s.weekOf), scoreOverall(s)] as const),
    )
    const founderByWeekKey = new Map(
      founderScores.map(s => [businessDayKey(s.weekOf), scoreOverall(s)] as const),
    )

    const closedStatuses = new Set(['delivered', 'cancelled'])
    const allProjects = [...projectsAsDev, ...projectsAsBd]
    const projectById = new Map<string, (typeof allProjects)[number]>()
    for (const p of allProjects) {
      if (!projectById.has(p.id)) projectById.set(p.id, p)
    }

    const milestonesByProject = new Map<string, typeof projectMilestones>()
    for (const m of projectMilestones) {
      const list = milestonesByProject.get(m.project.id) ?? []
      list.push(m)
      milestonesByProject.set(m.project.id, list)
    }

    type TaskRow = { id: string; title: string; status: string; hours: number; dateKey: string }
    type WeekProject = {
      projectId: string | null
      projectName: string
      hoursLogged: number
      hoursPlanned: number
      sharePct: number
      done: number
      partial: number
      planned: number
      moved: number
      tasks: TaskRow[]
      milestones: {
        id: string
        title: string
        status: string
        chip: MilestoneChip
        label: string
        daysLate: number | null
        dueDate: string | null
      }[]
      missedDeadline: { dueDate: string; daysLate: number; detail: string } | null
      blockers: {
        id: string
        description: string
        category: string
        status: string
        raisedAt: string
      }[]
    }

    function milestoneForWeek(
      m: (typeof projectMilestones)[number],
      weekStart: string,
      weekEnd: string,
      isLastWeek: boolean,
    ) {
      const classified = classifyMilestone(m, today)
      const dueKey = m.dueDate ? businessDayKey(m.dueDate) : null
      const completedKey = m.completedAt ? businessDayKey(m.completedAt) : null

      // Due this week
      if (dueKey && dueKey >= weekStart && dueKey <= weekEnd) return classified

      // Delayed: park on due-date week, or last week if due before the range
      if (classified.chip === 'delayed') {
        if (dueKey && dueKey < rangeStartKey) return isLastWeek ? classified : null
        if (dueKey && dueKey >= weekStart && dueKey <= weekEnd) return classified
        return null
      }

      // Completed / approved this week
      if (m.status === 'done') {
        if (completedKey && completedKey >= weekStart && completedKey <= weekEnd) return classified
        return null
      }

      // Active this week (in progress / QA / testing)
      if (m.status === 'in_progress' || m.status === 'ready_for_qa' || m.status === 'testing') {
        if (completedKey && completedKey < weekStart) return null
        // Still open through this week (due after week start or no due)
        if (dueKey && dueKey < weekStart) return null // already handled as delayed above
        return classified
      }

      return null
    }

    const rows = weeksMeta.map((w, weekIdx) => {
      const isLastWeek = weekIdx === weeksMeta.length - 1
      const days = hoursByDay.filter(d => d.dateKey >= w.startKey && d.dateKey <= w.endKey)
      const workingDays = days.filter(d => d.expected > 0)
      const leaveOrHolidayDays = days.filter(d => d.isHoliday || d.isFullDayLeave)
      const hoursLoggedW =
        Math.round(days.reduce((s, d) => s + d.logged, 0) * 10) / 10
      const hoursExpectedW =
        Math.round(
          workingDays
            .filter(d => d.phase === 'past' || d.phase === 'today')
            .reduce((s, d) => s + d.expected, 0) * 10,
        ) / 10
      const hoursExpectedFull =
        Math.round(workingDays.reduce((s, d) => s + d.expected, 0) * 10) / 10
      const hoursExpectedForPct = hoursExpectedW > 0 ? hoursExpectedW : hoursExpectedFull

      const elapsedWorking = workingDays.filter(d => d.phase !== 'future')
      const planDays = elapsedWorking.filter(d => d.hasPlan).length
      const workingElapsed = elapsedWorking.length
      const planRate =
        workingElapsed > 0 ? Math.min(100, Math.round((planDays / workingElapsed) * 100)) : null

      const eodEligible = elapsedWorking.filter(d => d.hasPlan)
      const eodDaysW = eodEligible.filter(d => d.hasEod).length
      const eodRate =
        eodEligible.length > 0
          ? Math.min(100, Math.round((eodDaysW / eodEligible.length) * 100))
          : null

      let tasksDone = 0
      let tasksTotal = 0
      const projectMap = new Map<
        string,
        {
          projectId: string | null
          projectName: string
          hoursLogged: number
          hoursPlanned: number
          done: number
          partial: number
          planned: number
          moved: number
          tasks: TaskRow[]
        }
      >()

      for (const log of dailyLogs) {
        const key = businessDayKey(log.date)
        if (key < w.startKey || key > w.endKey) continue
        for (const t of log.tasks) {
          tasksTotal += 1
          if (t.status === 'done') tasksDone += 1
          const pKey = t.project?.id ?? '__none__'
          let b = projectMap.get(pKey)
          if (!b) {
            b = {
              projectId: t.project?.id ?? null,
              projectName: t.project?.name ?? 'No project',
              hoursLogged: 0,
              hoursPlanned: 0,
              done: 0,
              partial: 0,
              planned: 0,
              moved: 0,
              tasks: [],
            }
            projectMap.set(pKey, b)
          }
          b.hoursLogged += t.actualHours ?? 0
          b.hoursPlanned += t.estimatedHours ?? 0
          if (t.status === 'done') b.done += 1
          else if (t.status === 'partial') b.partial += 1
          else if (t.status === 'moved') b.moved += 1
          else if (t.status === 'planned') b.planned += 1
          b.tasks.push({
            id: t.id,
            title: t.title,
            status: t.status,
            hours: t.actualHours ?? t.estimatedHours ?? 0,
            dateKey: key,
          })
        }
      }
      const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : null

      let mon = businessDayStart(w.startKey)
      for (let i = 0; i < 7; i++) {
        if (istWeekdayShort(mon) === 'Mon') break
        mon = businessDayStart(new Date(mon.getTime() - 36 * 60 * 60 * 1000))
      }
      const scoreKey = businessDayKey(mon)
      const founderOverall = founderByWeekKey.get(scoreKey) ?? null
      const selfOverall = selfByWeekKey.get(scoreKey) ?? null
      const weeklyOverall = founderOverall ?? selfOverall
      const weeklySource =
        founderOverall != null ? ('founder' as const) : selfOverall != null ? ('self' as const) : null

      const noPlanDays = elapsedWorking.filter(d => !d.hasPlan)
      const hoursShortW =
        Math.round(elapsedWorking.reduce((s, d) => s + d.loggedShort, 0) * 10) / 10

      const performanceScore = computePerformanceScore({
        hoursLogged: hoursLoggedW,
        hoursExpected: hoursExpectedForPct,
        planRate,
        eodRate,
        completionRate: taskPct,
        avgSelfScore: weeklyOverall,
      })

      const rangeLabel = `${formatIst(businessDayStart(w.startKey), { day: 'numeric', month: 'short' })}–${formatIst(businessDayStart(w.endKey), { day: 'numeric', month: 'short' })}`

      // Also surface projects that only have milestones/deadlines/blockers this week (0 hours)
      for (const [pid, list] of milestonesByProject) {
        if (projectMap.has(pid)) continue
        const any = list.some(m => milestoneForWeek(m, w.startKey, w.endKey, isLastWeek))
        if (any) {
          projectMap.set(pid, {
            projectId: pid,
            projectName: list[0]?.project.name ?? 'Project',
            hoursLogged: 0,
            hoursPlanned: 0,
            done: 0,
            partial: 0,
            planned: 0,
            moved: 0,
            tasks: [],
          })
        }
      }
      for (const p of projectById.values()) {
        if (projectMap.has(p.id) || !p.estimatedEnd || closedStatuses.has(p.status)) continue
        const dueKey = businessDayKey(p.estimatedEnd)
        const show =
          (dueKey >= w.startKey && dueKey <= w.endKey) ||
          (dueKey < rangeStartKey && isLastWeek && p.estimatedEnd < today)
        if (show) {
          projectMap.set(p.id, {
            projectId: p.id,
            projectName: p.name,
            hoursLogged: 0,
            hoursPlanned: 0,
            done: 0,
            partial: 0,
            planned: 0,
            moved: 0,
            tasks: [],
          })
        }
      }
      for (const b of blockers) {
        if (!b.project?.id || projectMap.has(b.project.id)) continue
        const raisedKey = businessDayKey(b.raisedAt)
        if (raisedKey >= w.startKey && raisedKey <= w.endKey) {
          projectMap.set(b.project.id, {
            projectId: b.project.id,
            projectName: b.project.name,
            hoursLogged: 0,
            hoursPlanned: 0,
            done: 0,
            partial: 0,
            planned: 0,
            moved: 0,
            tasks: [],
          })
        }
      }

      const weekHoursForShare = Math.max(
        hoursLoggedW,
        Math.round([...projectMap.values()].reduce((s, p) => s + p.hoursLogged, 0) * 10) / 10,
      )

      const projects: WeekProject[] = [...projectMap.values()]
        .map(b => {
          const hoursLoggedP = Math.round(b.hoursLogged * 10) / 10
          const hoursPlannedP = Math.round(b.hoursPlanned * 10) / 10
          const sharePct =
            weekHoursForShare > 0 ? Math.round((hoursLoggedP / weekHoursForShare) * 100) : 0

          const milestones = (b.projectId ? milestonesByProject.get(b.projectId) ?? [] : [])
            .map(m => {
              const classified = milestoneForWeek(m, w.startKey, w.endKey, isLastWeek)
              if (!classified) return null
              return {
                id: m.id,
                title: m.title,
                status: m.status,
                ...classified,
              }
            })
            .filter((x): x is NonNullable<typeof x> => x != null)
            .sort((a, b) => {
              const order = { delayed: 0, needs_attention: 1, upcoming: 2, approved: 3 }
              return order[a.chip] - order[b.chip]
            })

          const project = b.projectId ? projectById.get(b.projectId) : null
          let missedDeadline: WeekProject['missedDeadline'] = null
          if (project?.estimatedEnd && !closedStatuses.has(project.status) && project.estimatedEnd < today) {
            const dueKey = businessDayKey(project.estimatedEnd)
            const inWeek = dueKey >= w.startKey && dueKey <= w.endKey
            const beforeRangeLast = dueKey < rangeStartKey && isLastWeek
            if (inWeek || beforeRangeLast) {
              const days = differenceInCalendarDays(today, project.estimatedEnd)
              missedDeadline = {
                dueDate: project.estimatedEnd.toISOString(),
                daysLate: days,
                detail: `Due ${formatIstDate(project.estimatedEnd)} · ${days} day${days === 1 ? '' : 's'} late`,
              }
            }
          }

          const projectBlockers = blockers
            .filter(bl => {
              if (bl.project?.id !== b.projectId) return false
              const raisedKey = businessDayKey(bl.raisedAt)
              return raisedKey >= w.startKey && raisedKey <= w.endKey
            })
            .map(bl => ({
              id: bl.id,
              description: bl.description,
              category: bl.category,
              status: bl.status,
              raisedAt: bl.raisedAt.toISOString(),
            }))

          return {
            projectId: b.projectId,
            projectName: b.projectName,
            hoursLogged: hoursLoggedP,
            hoursPlanned: hoursPlannedP,
            sharePct,
            done: b.done,
            partial: b.partial,
            planned: b.planned,
            moved: b.moved,
            tasks: b.tasks,
            milestones,
            missedDeadline,
            blockers: projectBlockers,
          }
        })
        .sort((a, b) => b.hoursLogged - a.hoursLogged || b.hoursPlanned - a.hoursPlanned)

      return {
        startKey: w.startKey,
        endKey: w.endKey,
        label: rangeLabel,
        hoursLogged: hoursLoggedW,
        hoursExpected: hoursExpectedForPct,
        hoursPct:
          hoursExpectedForPct > 0
            ? Math.round((hoursLoggedW / hoursExpectedForPct) * 100)
            : null,
        hoursShort: hoursShortW,
        planDays,
        workingDays: workingElapsed,
        planRate,
        eodDays: eodDaysW,
        eodEligible: eodEligible.length,
        eodRate,
        tasksDone,
        tasksTotal,
        taskPct,
        weeklyOverall,
        weeklySource,
        leaveDayCount: leaveOrHolidayDays.length,
        leaveChip:
          leaveOrHolidayDays.length === 0
            ? null
            : leaveOrHolidayDays.some(d => d.isHoliday) &&
                leaveOrHolidayDays.some(d => d.isFullDayLeave)
              ? `${leaveOrHolidayDays.length} leave/holiday`
              : leaveOrHolidayDays.every(d => d.isHoliday)
                ? `${leaveOrHolidayDays.length} holiday`
                : `${leaveOrHolidayDays.length} leave`,
        noPlanDates: noPlanDays.map(d =>
          formatIst(businessDayStart(d.dateKey), { day: 'numeric', month: 'short' }),
        ),
        performanceScore,
        hasWorkingDays: workingDays.length > 0,
        projectCount: projects.length,
        projects,
        dayMeta: days.map(d => ({
          dateKey: d.dateKey,
          date: d.date,
          leaveBadge: d.leaveBadge,
          isHoliday: d.isHoliday,
          isFullDayLeave: d.isFullDayLeave,
          holidayName: d.holidayName,
          logged: d.logged,
        })),
      }
    })

    const ranked = rows.filter(r => r.hasWorkingDays)
    let bestKey: string | null = null
    let weakKey: string | null = null
    if (ranked.length >= 2) {
      const sorted = [...ranked].sort((a, b) => b.performanceScore - a.performanceScore)
      bestKey = sorted[0].startKey
      weakKey = sorted[sorted.length - 1].startKey
      if (bestKey === weakKey) {
        bestKey = null
        weakKey = null
      }
    }

    const best = bestKey ? rows.find(r => r.startKey === bestKey) : null
    const weak = weakKey ? rows.find(r => r.startKey === weakKey) : null
    const why: string[] = []
    if (best) {
      const bits = [
        `${best.hoursLogged}h of ${best.hoursExpected}h`,
        best.planRate != null && best.planRate >= 100
          ? 'plans every day'
          : best.planRate != null
            ? `plans ${best.planDays}/${best.workingDays} days`
            : null,
        best.tasksTotal > 0 ? `${best.tasksDone}/${best.tasksTotal} tasks done` : null,
      ].filter(Boolean)
      why.push(`Best: ${best.label} — ${bits.join(', ')}.`)
    }
    if (weak) {
      const bits: string[] = []
      if (weak.noPlanDates.length > 0) {
        bits.push(
          `${weak.noPlanDates.length} day${weak.noPlanDates.length === 1 ? '' : 's'} without plan (${weak.noPlanDates.join(', ')})`,
        )
      }
      if (weak.hoursShort >= 1) {
        bits.push(`${weak.hoursShort}h short of target`)
      }
      if (weak.taskPct != null && weak.taskPct < 80 && weak.tasksTotal > 0) {
        bits.push(`only ${weak.tasksDone}/${weak.tasksTotal} tasks done`)
      }
      if (bits.length === 0) {
        bits.push(`score ${weak.performanceScore}/100`)
      }
      why.push(`Needs improvement: ${weak.label} — ${bits.join(', ')}.`)
    }
    if (ranked.length >= 3) {
      const first = ranked[0]
      const last = ranked[ranked.length - 1]
      const delta = last.performanceScore - first.performanceScore
      if (Math.abs(delta) >= 5) {
        why.push(
          delta > 0
            ? `Trend: improving across the period (+${delta} points week-over-week from first to last).`
            : `Trend: declining across the period (${delta} points from first to last week).`,
        )
      }
    }

    return {
      rows: rows.map(r => ({
        ...r,
        badge:
          bestKey && r.startKey === bestKey
            ? ('best' as const)
            : weakKey && r.startKey === weakKey
              ? ('needs_improvement' as const)
              : null,
      })),
      bestKey,
      weakKey,
      why: why.slice(0, 3),
    }
  })()

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
      planRate: (() => {
        const elapsed = hoursByDay.filter(
          d => d.phase !== 'future' && d.expected > 0,
        ).length
        if (elapsed <= 0) return null
        const planned = hoursByDay.filter(
          d => d.phase !== 'future' && d.expected > 0 && d.hasPlan,
        ).length
        return Math.min(100, Math.round((planned / elapsed) * 100))
      })(),
      eodRate: (() => {
        const planned = hoursByDay.filter(
          d => d.phase !== 'future' && d.expected > 0 && d.hasPlan,
        ).length
        if (planned <= 0) return null
        const eods = hoursByDay.filter(
          d => d.phase !== 'future' && d.expected > 0 && d.hasPlan && d.hasEod,
        ).length
        return Math.min(100, Math.round((eods / planned) * 100))
      })(),
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
    weekByWeek,
    projectActivity: (() => {
      type TaskRow = { id: string; title: string; status: string; hours: number; dateKey: string }
      type ProjectBucket = {
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
        tasks: TaskRow[]
      }

      const emptyBucket = (projectId: string | null, projectName: string): ProjectBucket => ({
        projectId,
        projectName,
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
      })

      const addTask = (b: ProjectBucket, t: {
        id: string
        title: string
        status: string
        actualHours: number | null
        estimatedHours: number | null
        dateKey: string
      }) => {
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
          dateKey: t.dateKey,
        })
      }

      const finalize = (b: ProjectBucket) => ({
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
      })

      // --- Flat project totals (for summary strip + milestone attachment) ---
      const flatMap = new Map<string, ProjectBucket>()
      for (const log of dailyLogs) {
        const dateKey = businessDayKey(log.date)
        for (const t of log.tasks) {
          const key = t.project?.id ?? '__none__'
          let b = flatMap.get(key)
          if (!b) {
            b = emptyBucket(t.project?.id ?? null, t.project?.name ?? 'No project')
            flatMap.set(key, b)
          }
          addTask(b, {
            id: t.id,
            title: t.title,
            status: t.status,
            actualHours: t.actualHours,
            estimatedHours: t.estimatedHours,
            dateKey,
          })
        }
      }

      const closedStatuses = new Set(['delivered', 'cancelled'])
      const allProjects = [...projectsAsDev, ...projectsAsBd]
      const projectById = new Map<string, (typeof allProjects)[number]>()
      for (const p of allProjects) {
        if (!projectById.has(p.id)) projectById.set(p.id, p)
      }

      const milestonesByProject = new Map<string, typeof projectMilestones>()
      for (const m of projectMilestones) {
        const list = milestonesByProject.get(m.project.id) ?? []
        list.push(m)
        milestonesByProject.set(m.project.id, list)
      }

      const blockersByProject = new Map<string, typeof blockers>()
      const orphanBlockers: typeof blockers = []
      for (const b of blockers) {
        if (b.project?.id) {
          const list = blockersByProject.get(b.project.id) ?? []
          list.push(b)
          blockersByProject.set(b.project.id, list)
        } else {
          orphanBlockers.push(b)
        }
      }

      // Ensure projects with milestones/deadlines/blockers appear even with 0 tasks this period
      for (const p of projectById.values()) {
        if (!flatMap.has(p.id)) {
          flatMap.set(p.id, emptyBucket(p.id, p.name))
        }
      }
      for (const pid of milestonesByProject.keys()) {
        if (!flatMap.has(pid)) {
          const name = milestonesByProject.get(pid)?.[0]?.project.name ?? 'Project'
          flatMap.set(pid, emptyBucket(pid, name))
        }
      }
      for (const pid of blockersByProject.keys()) {
        if (!flatMap.has(pid)) {
          const name = blockersByProject.get(pid)?.[0]?.project?.name ?? 'Project'
          flatMap.set(pid, emptyBucket(pid, name))
        }
      }

      const summaries = [...flatMap.values()]
        .map(b => {
          const project = b.projectId ? projectById.get(b.projectId) : null
          let missedDeadline: {
            dueDate: string
            daysLate: number
            detail: string
          } | null = null
          if (project?.estimatedEnd && !closedStatuses.has(project.status) && project.estimatedEnd < today) {
            const days = differenceInCalendarDays(today, project.estimatedEnd)
            missedDeadline = {
              dueDate: project.estimatedEnd.toISOString(),
              daysLate: days,
              detail: `Due ${formatIstDate(project.estimatedEnd)} · ${days} day${days === 1 ? '' : 's'} late`,
            }
          }

          const milestones = (b.projectId ? milestonesByProject.get(b.projectId) ?? [] : [])
            .map(m => {
              const classified = classifyMilestone(m, today)
              return {
                id: m.id,
                title: m.title,
                status: m.status,
                ...classified,
              }
            })
            // Prefer delayed / needs attention first, then upcoming, approved last
            .sort((a, b) => {
              const order = { delayed: 0, needs_attention: 1, upcoming: 2, approved: 3 }
              return order[a.chip] - order[b.chip]
            })

          const projectBlockers = (b.projectId ? blockersByProject.get(b.projectId) ?? [] : []).map(bl => ({
            id: bl.id,
            description: bl.description,
            category: bl.category,
            status: bl.status,
            raisedAt: bl.raisedAt.toISOString(),
            resolvedAt: bl.resolvedAt?.toISOString() ?? null,
            escalatedToFounder: bl.escalatedToFounder,
          }))

          return {
            ...finalize(b),
            milestones,
            missedDeadline,
            blockers: projectBlockers,
          }
        })
        .sort((a, b) => b.hoursLogged - a.hoursLogged || b.hoursPlanned - a.hoursPlanned)

      // --- Week × project nesting ---
      const weeksMeta = eachClippedWeeks(from, toEnd)
      const weeks = weeksMeta.map(w => {
        const weekMap = new Map<string, ProjectBucket>()
        for (const log of dailyLogs) {
          const dateKey = businessDayKey(log.date)
          if (dateKey < w.startKey || dateKey > w.endKey) continue
          for (const t of log.tasks) {
            const key = t.project?.id ?? '__none__'
            let b = weekMap.get(key)
            if (!b) {
              b = emptyBucket(t.project?.id ?? null, t.project?.name ?? 'No project')
              weekMap.set(key, b)
            }
            addTask(b, {
              id: t.id,
              title: t.title,
              status: t.status,
              actualHours: t.actualHours,
              estimatedHours: t.estimatedHours,
              dateKey,
            })
          }
        }
        const projects = [...weekMap.values()]
          .map(finalize)
          .sort((a, b) => b.hoursLogged - a.hoursLogged || b.hoursPlanned - a.hoursPlanned)
        const weekHours = Math.round(projects.reduce((s, p) => s + p.hoursLogged, 0) * 10) / 10
        return {
          startKey: w.startKey,
          endKey: w.endKey,
          label: w.label,
          hoursLogged: weekHours,
          projects,
        }
      }).filter(w => w.projects.length > 0)

      // Flat list kept for any legacy consumers / totals strip
      const flat = summaries.map(({ milestones: _m, missedDeadline: _d, blockers: _b, ...rest }) => rest)

      return { flat, summaries, weeks }
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
    otherIssues: (() => {
      const rows: {
        kind: 'deadline' | 'blunder' | 'at_risk' | 'blocker'
        title: string
        detail: string
        date: string | null
        href: string | null
      }[] = []

      // Project-tied deadlines / blockers now live under project summaries.
      // Keep non-project (or goal / blunder / orphan) items here.
      for (const s of scores.filter(sc => sc.repeatedMistake)) {
        rows.push({
          kind: 'blunder',
          title: s.founderScore
            ? 'Founder flagged a repeated mistake'
            : 'Repeated mistake on weekly check-in',
          detail: s.selfNotes?.trim() || `Week of ${formatIst(s.weekOf, { month: 'short', day: 'numeric' })}`,
          date: s.weekOf.toISOString(),
          href: `/reports/team?tab=individual&memberId=${encodeURIComponent(memberId)}`,
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

      for (const b of blockers) {
        if (b.project?.id) continue
        rows.push({
          kind: 'blocker',
          title: b.description,
          detail: b.category || 'Blocker',
          date: b.raisedAt.toISOString(),
          href: null,
        })
      }

      return rows
    })(),
    // Legacy flat issues list (deadlines card removed in UI; kept for API compat / otherIssues mirror)
    issues: (() => {
      const closed = new Set(['delivered', 'cancelled'])
      const seenProjects = new Set<string>()
      const rows: {
        kind: 'deadline' | 'blunder' | 'at_risk'
        title: string
        detail: string
        date: string | null
        href: string | null
        projectId: string | null
      }[] = []

      for (const p of [...projectsAsDev, ...projectsAsBd]) {
        if (seenProjects.has(p.id) || !p.estimatedEnd || closed.has(p.status)) continue
        seenProjects.add(p.id)
        if (p.estimatedEnd < today) {
          const days = differenceInCalendarDays(today, p.estimatedEnd)
          rows.push({
            kind: 'deadline',
            title: `Missed project deadline: ${p.name}`,
            detail: `Due ${formatIstDate(p.estimatedEnd)} · ${days} day${days === 1 ? '' : 's'} late`,
            date: p.estimatedEnd.toISOString(),
            href: `/projects/${p.id}`,
            projectId: p.id,
          })
        }
      }

      for (const m of projectMilestones) {
        if (!m.dueDate || m.status === 'done' || m.dueDate >= today) continue
        const days = differenceInCalendarDays(today, m.dueDate)
        rows.push({
          kind: 'deadline',
          title: `Missed milestone: ${m.title}`,
          detail: `${m.project.name} · due ${formatIst(m.dueDate, { month: 'short', day: 'numeric' })} · ${days}d late`,
          date: m.dueDate.toISOString(),
          href: `/projects/${m.project.id}`,
          projectId: m.project.id,
        })
      }

      for (const s of scores.filter(sc => sc.repeatedMistake)) {
        rows.push({
          kind: 'blunder',
          title: s.founderScore
            ? 'Founder flagged a repeated mistake'
            : 'Repeated mistake on weekly check-in',
          detail: s.selfNotes?.trim() || `Week of ${formatIst(s.weekOf, { month: 'short', day: 'numeric' })}`,
          date: s.weekOf.toISOString(),
          href: `/reports/team?tab=individual&memberId=${encodeURIComponent(memberId)}`,
          projectId: null,
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
            `Check-in week of ${formatIst(c.weekOf, { month: 'short', day: 'numeric' })} · ${c.progressPct}%`,
          date: c.weekOf.toISOString(),
          href: `/projects/${c.project.id}`,
          projectId: c.project.id,
        })
      }

      for (const g of goals.filter(gl => gl.status === 'missed')) {
        rows.push({
          kind: 'deadline',
          title: `Missed goal: ${g.title}`,
          detail: g.quarter,
          date: g.targetDate?.toISOString() ?? null,
          href: '/goals',
          projectId: null,
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
