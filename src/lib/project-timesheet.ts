import { taskHoursTowardLogged } from '@/lib/project-hours'

export type TimesheetEntry = {
  id: string
  date: string
  title: string
  memberId: string
  memberName: string
  taskType: string
  status: string
  estimatedHours: number | null
  actualHours: number | null
  eodNotes: string | null
}

export type TimesheetMilestone = {
  id: string
  title: string
  status: string
  dueDate: string | null
  completedAt: string | null
}

function startOfWeekUtc(d: Date) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = x.getUTCDay() // 0 Sun
  const diff = day === 0 ? -6 : 1 - day // Monday start
  x.setUTCDate(x.getUTCDate() + diff)
  return x
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

export function entryLoggedHours(entry: Pick<TimesheetEntry, 'status' | 'actualHours' | 'estimatedHours'>) {
  return taskHoursTowardLogged(entry)
}

export function buildTimesheetSummary(
  entries: TimesheetEntry[],
  opts: {
    estimatedHours: number | null
    milestones: TimesheetMilestone[]
  },
) {
  const byMember = new Map<string, { memberId: string; memberName: string; hours: number; entries: number }>()
  const byWeek = new Map<string, number>()
  const byDay = new Map<string, number>()
  const byTaskType = new Map<string, number>()

  let loggedHours = 0
  let plannedOnlyHours = 0
  let doneCount = 0
  let blockedCount = 0

  for (const entry of entries) {
    if (entry.status === 'skipped') continue
    const hours = entryLoggedHours(entry)
    const isLogged = entry.actualHours != null
    if (isLogged) loggedHours += hours
    else plannedOnlyHours += hours

    if (entry.status === 'done') doneCount += 1
    if (entry.status === 'blocked') blockedCount += 1

    const member = byMember.get(entry.memberId) ?? {
      memberId: entry.memberId,
      memberName: entry.memberName,
      hours: 0,
      entries: 0,
    }
    member.hours = Number((member.hours + hours).toFixed(2))
    member.entries += 1
    byMember.set(entry.memberId, member)

    const day = entry.date.slice(0, 10)
    byDay.set(day, Number(((byDay.get(day) ?? 0) + hours).toFixed(2)))

    const weekKey = isoDate(startOfWeekUtc(new Date(entry.date)))
    byWeek.set(weekKey, Number(((byWeek.get(weekKey) ?? 0) + hours).toFixed(2)))

    byTaskType.set(entry.taskType, Number(((byTaskType.get(entry.taskType) ?? 0) + hours).toFixed(2)))
  }

  const totalHours = Number((loggedHours + plannedOnlyHours).toFixed(2))
  const estimated = opts.estimatedHours
  const burnPct = estimated && estimated > 0 ? Math.round((totalHours / estimated) * 100) : null
  const remaining = estimated != null ? Number((estimated - totalHours).toFixed(2)) : null

  const now = new Date()
  const thisWeekStart = startOfWeekUtc(now)
  const thisWeekKey = isoDate(thisWeekStart)
  const lastWeekKey = isoDate(addDays(thisWeekStart, -7))
  const hoursThisWeek = byWeek.get(thisWeekKey) ?? 0
  const hoursLastWeek = byWeek.get(lastWeekKey) ?? 0

  // Last 8 weeks for chart (oldest → newest)
  const weekBars: Array<{ weekStart: string; hours: number; label: string }> = []
  for (let i = 7; i >= 0; i--) {
    const start = addDays(thisWeekStart, -7 * i)
    const key = isoDate(start)
    const hours = byWeek.get(key) ?? 0
    const label = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    weekBars.push({ weekStart: key, hours, label })
  }

  const members = [...byMember.values()].sort((a, b) => b.hours - a.hours)
  const taskTypes = [...byTaskType.entries()]
    .map(([type, hours]) => ({ type, hours }))
    .sort((a, b) => b.hours - a.hours)

  const milestonesDone = opts.milestones.filter(m => m.status === 'done').length
  const milestonesTotal = opts.milestones.length

  return {
    totalHours,
    loggedHours: Number(loggedHours.toFixed(2)),
    plannedOnlyHours: Number(plannedOnlyHours.toFixed(2)),
    estimatedHours: estimated,
    burnPct,
    remaining,
    hoursThisWeek: Number(hoursThisWeek.toFixed(2)),
    hoursLastWeek: Number(hoursLastWeek.toFixed(2)),
    entryCount: entries.filter(e => e.status !== 'skipped').length,
    doneCount,
    blockedCount,
    members,
    taskTypes,
    weekBars,
    byDay,
    milestonesDone,
    milestonesTotal,
  }
}

export function groupEntriesByWeek(entries: TimesheetEntry[]) {
  const groups = new Map<string, Map<string, TimesheetEntry[]>>()

  for (const entry of entries) {
    if (entry.status === 'skipped') continue
    const weekKey = isoDate(startOfWeekUtc(new Date(entry.date)))
    const dayKey = entry.date.slice(0, 10)
    if (!groups.has(weekKey)) groups.set(weekKey, new Map())
    const days = groups.get(weekKey)!
    const list = days.get(dayKey) ?? []
    list.push(entry)
    days.set(dayKey, list)
  }

  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekStart, days]) => ({
      weekStart,
      days: [...days.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([date, dayEntries]) => ({
          date,
          entries: dayEntries,
          hours: Number(dayEntries.reduce((s, e) => s + entryLoggedHours(e), 0).toFixed(2)),
        })),
      hours: Number(
        [...days.values()]
          .flat()
          .reduce((s, e) => s + entryLoggedHours(e), 0)
          .toFixed(2),
      ),
    }))
}
