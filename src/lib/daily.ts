import { prisma } from '@/lib/prisma'
import { IST_TIMEZONE, formatIstWeekdayLong } from '@/lib/ist'
import { DAILY_TASK_TYPES } from '@/lib/daily-task-type-defaults'

/** Company operates in India — all DailyLog "days" use this timezone. */
export const BUSINESS_TIMEZONE = IST_TIMEZONE

/**
 * Calendar day key (YYYY-MM-DD) in Asia/Kolkata.
 * Avoids UTC vs local mismatches between Vercel and developer machines.
 */
export function businessDayKey(input: Date | string = new Date()): string {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const date = typeof input === 'string' ? new Date(input) : input
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Start of the business calendar day as a Date.
 * Stored/queried for DailyLog.date — midnight IST (= previous day 18:30 UTC).
 * Matches what `startOfDay` produced on IST machines; works the same on Vercel UTC.
 */
export function businessDayStart(input: Date | string = new Date()): Date {
  const key = businessDayKey(input)
  return new Date(`${key}T00:00:00+05:30`)
}

export function isSameBusinessDay(a: Date | string, b: Date | string = new Date()) {
  return businessDayKey(a) === businessDayKey(b)
}

export const MAX_DAILY_PLAN_HOURS = 8

/** Founder is not required to submit a morning plan / EOD. */
export function requiresDailyCadence(role: string) {
  return role !== 'Founder'
}

export {
  DAILY_TASK_TYPE_GROUPS,
  DAILY_TASK_TYPES,
  dailyTaskTypeGroupsForRole,
  defaultDailyTaskType,
  type DailyTaskType,
  type TaskTypeGroup,
} from '@/lib/daily-task-type-defaults'

const LEGACY_TASK_TYPE_LABELS: Record<string, string> = {
  bd: 'BD / Sales',
  qa: 'QA',
  hr: 'HR',
  social_media: 'Social media',
}

export const DAILY_TASK_TYPE_COLORS: Record<string, string> = {
  feature: 'bg-green-100 text-green-800',
  bug: 'bg-red-100 text-red-800',
  backend: 'bg-indigo-100 text-indigo-800',
  review: 'bg-purple-100 text-purple-800',
  research: 'bg-amber-100 text-amber-800',
  meeting: 'bg-gray-100 text-gray-700',
  admin: 'bg-gray-100 text-gray-500',
}

export function dailyTaskTypeLabel(value: string) {
  return (
    DAILY_TASK_TYPES.find(t => t.value === value)?.label ??
    LEGACY_TASK_TYPE_LABELS[value] ??
    value.replace(/_/g, ' ')
  )
}

export function dailyTaskTypeColor(value: string) {
  if (DAILY_TASK_TYPE_COLORS[value]) return DAILY_TASK_TYPE_COLORS[value]
  if (value.startsWith('bd_') || value === 'bd') return 'bg-blue-100 text-blue-800'
  if (value.startsWith('qa_') || value === 'qa') return 'bg-teal-100 text-teal-800'
  if (value.startsWith('hr_') || value === 'hr') return 'bg-rose-100 text-rose-800'
  if (value.startsWith('social_') || value === 'social_media') return 'bg-pink-100 text-pink-800'
  if (value.startsWith('mgmt_')) return 'bg-indigo-100 text-indigo-800'
  if (value.startsWith('founder_')) return 'bg-purple-100 text-purple-800'
  return 'bg-gray-100 text-gray-600'
}

const openLogInclude = {
  member: true,
  tasks: {
    include: { project: { select: { name: true } } },
    orderBy: { priority: 'asc' as const },
  },
}

/** Most recent DailyLog with a morning plan submitted but EOD still open */
export async function findOpenDailyLog(memberId: string) {
  const pendingPast = await findPendingPastEodLog(memberId)
  if (pendingPast) return pendingPast

  const today = businessDayStart()
  return prisma.dailyLog.findFirst({
    where: {
      memberId,
      planSubmittedAt: { not: null },
      eodSubmittedAt: null,
      date: today,
    },
    include: openLogInclude,
  })
}

export function isPastDailyLogDate(logDate: Date | string, today = businessDayStart()) {
  return businessDayStart(logDate) < today
}

const pendingPastEodWhere = (memberId: string, today = businessDayStart()) => ({
  memberId,
  planSubmittedAt: { not: null } as const,
  eodSubmittedAt: null,
  date: { lt: today },
})

/** Lightweight check for banners/gates — no task graph. */
export async function findPendingPastEodLogSummary(memberId: string) {
  return prisma.dailyLog.findFirst({
    where: pendingPastEodWhere(memberId),
    select: { id: true, date: true },
    orderBy: { date: 'asc' },
  })
}

/** Oldest open EOD from before today (e.g. Friday still open on Monday). */
export async function findPendingPastEodLog(memberId: string) {
  return prisma.dailyLog.findFirst({
    where: pendingPastEodWhere(memberId),
    include: openLogInclude,
    orderBy: { date: 'asc' },
  })
}

export function formatDailyLogDate(date: Date | string) {
  return formatIstWeekdayLong(date)
}

export const dailyLogWithTasksInclude = openLogInclude

/** True if EOD has not been submitted yet, or was submitted today (editable until midnight IST). */
export function canEditEod(eodSubmittedAt: Date | string | null | undefined): boolean {
  if (!eodSubmittedAt) return true
  return isSameBusinessDay(eodSubmittedAt)
}

export function isEodReadOnly(eodSubmittedAt: Date | string | null | undefined): boolean {
  return !!eodSubmittedAt && !canEditEod(eodSubmittedAt)
}

/** Today's log with EOD submitted today — available for same-day edits. */
export function findTodayEditableEodLog(memberId: string) {
  const today = businessDayStart()
  return prisma.dailyLog.findFirst({
    where: {
      memberId,
      date: today,
      eodSubmittedAt: { not: null },
    },
    include: openLogInclude,
  }).then(log => (log && canEditEod(log.eodSubmittedAt) ? log : null))
}

export type CarryOverMovedTask = {
  id: string
  title: string
  taskType: string
  priority: string
  status: string
  projectId: string | null
  estimatedHours: number | null
  project: { id: string; name: string } | null
}

export type CarryOverMovedResult = {
  sourceDate: Date
  sourceLogId: string
  carryOverNotes: string | null
  /** Same-day EOD (carried to tomorrow) vs previous day (ready to plan). */
  sameDay: boolean
  tasks: CarryOverMovedTask[]
}

const CARRY_OVER_STATUSES = ['moved', 'partial'] as const

/**
 * Tasks marked "moved" or "partial" on the latest EOD that still need to land in a future morning plan.
 * - After today's EOD: show today's carry-over tasks (sameDay=true).
 * - Next morning before planning: show previous EOD's tasks for prefilling.
 * Once any later day has a submitted plan, carry-over is considered absorbed.
 */
export async function findCarryOverMovedTasks(
  memberId: string,
): Promise<CarryOverMovedResult | null> {
  const today = businessDayStart()
  const taskSelect = {
    id: true,
    title: true,
    taskType: true,
    priority: true,
    status: true,
    projectId: true,
    estimatedHours: true,
    project: { select: { id: true, name: true } },
  } as const

  const todayLog = await prisma.dailyLog.findUnique({
    where: { memberId_date: { memberId, date: today } },
    select: {
      id: true,
      date: true,
      planSubmittedAt: true,
      eodSubmittedAt: true,
      carryOver: true,
      tasks: {
        where: { status: { in: [...CARRY_OVER_STATUSES] } },
        select: taskSelect,
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  // Same day: EOD done with carry-over tasks → show on dashboard until tomorrow's plan.
  if (todayLog?.eodSubmittedAt && todayLog.tasks.length > 0) {
    return {
      sourceDate: todayLog.date,
      sourceLogId: todayLog.id,
      carryOverNotes: todayLog.carryOver,
      sameDay: true,
      tasks: todayLog.tasks,
    }
  }

  // Already planned today → don't prefill / don't show pending carry-over.
  if (todayLog?.planSubmittedAt) return null

  const pastLog = await prisma.dailyLog.findFirst({
    where: {
      memberId,
      date: { lt: today },
      eodSubmittedAt: { not: null },
      tasks: { some: { status: { in: [...CARRY_OVER_STATUSES] } } },
    },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      date: true,
      carryOver: true,
      tasks: {
        where: { status: { in: [...CARRY_OVER_STATUSES] } },
        select: taskSelect,
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })

  if (!pastLog?.tasks.length) return null

  const absorbed = await prisma.dailyLog.findFirst({
    where: {
      memberId,
      date: { gt: pastLog.date },
      planSubmittedAt: { not: null },
    },
    select: { id: true },
  })
  if (absorbed) return null

  return {
    sourceDate: pastLog.date,
    sourceLogId: pastLog.id,
    carryOverNotes: pastLog.carryOver,
    sameDay: false,
    tasks: pastLog.tasks,
  }
}

/** Map carry-over tasks into morning-plan form rows. */
export function carryOverTasksToPlanRows(tasks: CarryOverMovedTask[]) {
  return tasks.map(t => ({
    title: t.title,
    taskType: t.taskType,
    priority: t.priority || 'medium',
    projectId: t.projectId ?? '',
    estimatedHours: t.estimatedHours != null ? String(t.estimatedHours) : '',
  }))
}
