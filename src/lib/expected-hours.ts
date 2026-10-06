import { prisma } from '@/lib/prisma'
import { businessDayKey, businessDayStart, MAX_DAILY_PLAN_HOURS } from '@/lib/daily'
/** Standard working day used for utilisation / missing-hours targets. */
export const STANDARD_DAY_HOURS = MAX_DAILY_PLAN_HOURS // 8

/** Hours deducted from the day target for an approved short leave (no duration field on LeaveRequest). */
export const SHORT_LEAVE_HOURS = 2

/** Hours deducted from the day target for an approved half-day leave. */
export const HALF_DAY_LEAVE_HOURS = 4.5

/** Full-day leave types: expected hours = 0; day does not count as missing. */
export const FULL_DAY_LEAVE_TYPES = [
  'full_day',
  'birthday_leave',
  'comp_off_leave',
] as const

export type LeaveForExpectedHours = {
  leaveType: string
  startDate: Date | string
  endDate: Date | string
  timeSlot?: string | null
  /** Optional; LeaveRequest has no duration field today — if present, used instead of SHORT_LEAVE_HOURS. */
  durationHours?: number | null
  status?: string
}

export type ExpectedHoursDay = {
  dateKey: string
  expectedHours: number
  leaveHoursDeducted: number
  leaveType: string | null
  timeSlot: string | null
  /** Neutral UI hint, e.g. "Short leave · expected 6h" or "On leave". Null when no reducing leave. */
  leaveHint: string | null
  isFullDayLeave: boolean
}

function toDateKey(input: Date | string): string {
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10)
    return businessDayKey(new Date(input))
  }
  return businessDayKey(input)
}

function leaveCoversDateKey(leave: LeaveForExpectedHours, dateKey: string): boolean {
  const start = toDateKey(leave.startDate)
  const end = toDateKey(leave.endDate)
  return dateKey >= start && dateKey <= end
}

/**
 * Hours to deduct from STANDARD_DAY_HOURS for one leave row.
 * WFH = 0. Short leave uses durationHours when set, else SHORT_LEAVE_HOURS (2).
 */
export function leaveHoursDeduction(leave: LeaveForExpectedHours): number {
  const type = leave.leaveType
  if (type === 'work_from_home') return 0
  if (type === 'short_leave') {
    const custom = leave.durationHours
    if (custom != null && Number.isFinite(custom) && custom > 0) return custom
    return SHORT_LEAVE_HOURS
  }
  if (type === 'half_day') return HALF_DAY_LEAVE_HOURS
  if ((FULL_DAY_LEAVE_TYPES as readonly string[]).includes(type)) return STANDARD_DAY_HOURS
  // Unknown types treated as full-day balance leaves (same as leave-usage else branch).
  if (type && type !== 'work_from_home') return STANDARD_DAY_HOURS
  return 0
}

function formatExpectedHint(leaveType: string, _timeSlot: string | null, expectedHours: number): string {
  if (expectedHours <= 0) return 'On leave'
  const shortName =
    leaveType === 'short_leave'
      ? 'Short leave'
      : leaveType === 'half_day'
        ? 'Half day'
        : leaveType === 'birthday_leave'
          ? 'Birthday leave'
          : leaveType === 'comp_off_leave'
            ? 'Comp Off leave'
            : 'Full day leave'
  const expected =
    Number.isInteger(expectedHours) ? String(expectedHours) : expectedHours.toFixed(1).replace(/\.0$/, '')
  return `${shortName} · expected ${expected}h`
}

/**
 * Pure: expected hours for one calendar day given approved leave rows that may cover it.
 * Only approved leave should be passed (or rows with status === 'approved').
 */
export function computeExpectedHoursForDay(
  date: Date | string,
  leaves: LeaveForExpectedHours[],
): ExpectedHoursDay {
  const dateKey = toDateKey(date)
  const covering = leaves.filter(l => {
    if (l.status && l.status !== 'approved') return false
    return leaveCoversDateKey(l, dateKey)
  })

  let bestDeduction = 0
  let best: LeaveForExpectedHours | null = null
  for (const leave of covering) {
    const d = leaveHoursDeduction(leave)
    if (d > bestDeduction) {
      bestDeduction = d
      best = leave
    }
  }

  const expectedHours = Math.max(0, Math.round((STANDARD_DAY_HOURS - bestDeduction) * 10) / 10)
  const isFullDayLeave = expectedHours <= 0 && bestDeduction >= STANDARD_DAY_HOURS
  const leaveType = best && bestDeduction > 0 ? best.leaveType : null
  const timeSlot = best && bestDeduction > 0 ? (best.timeSlot ?? null) : null
  const leaveHint =
    leaveType != null ? formatExpectedHint(leaveType, timeSlot, expectedHours) : null

  return {
    dateKey,
    expectedHours,
    leaveHoursDeducted: bestDeduction,
    leaveType,
    timeSlot,
    leaveHint,
    isFullDayLeave,
  }
}

function nextBusinessDayStart(from: Date): Date {
  const key = businessDayKey(from)
  const [y, m, d] = key.split('-').map(Number)
  const noonIst = new Date(Date.UTC(y, m - 1, d, 6, 30))
  noonIst.setUTCDate(noonIst.getUTCDate() + 1)
  return businessDayStart(noonIst)
}

async function fetchApprovedLeavesOverlapping(
  memberIds: string[],
  from: Date,
  to: Date,
): Promise<
  Array<{
    memberId: string
    leaveType: string
    startDate: Date
    endDate: Date
    timeSlot: string | null
  }>
> {
  if (memberIds.length === 0) return []
  const rangeStart = businessDayStart(from)
  const rangeEndExclusive = nextBusinessDayStart(businessDayStart(to))

  return prisma.leaveRequest.findMany({
    where: {
      memberId: { in: memberIds },
      status: 'approved',
      startDate: { lt: rangeEndExclusive },
      endDate: { gte: rangeStart },
    },
    select: {
      memberId: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      timeSlot: true,
    },
  })
}

/** Expected hours for one member on one day (approved leave only). */
export async function getExpectedHours(
  memberId: string,
  date: Date | string,
): Promise<ExpectedHoursDay> {
  const dayStart = businessDayStart(date)
  const leaves = await fetchApprovedLeavesOverlapping([memberId], dayStart, dayStart)
  return computeExpectedHoursForDay(dayStart, leaves)
}

export type ExpectedHoursBatch = Map<string, Map<string, ExpectedHoursDay>>
// memberId → dateKey → ExpectedHoursDay

/**
 * Batch expected hours for many members over an inclusive date range.
 * One leave query — avoids N+1. Weekends still return 8 (or leave-adjusted);
 * callers that skip weekends should filter date keys themselves.
 */
export async function getExpectedHoursBatch(
  memberIds: string[],
  from: Date | string,
  to: Date | string,
): Promise<ExpectedHoursBatch> {
  const uniqueIds = [...new Set(memberIds)]
  const fromStart = businessDayStart(from)
  const toStart = businessDayStart(to)
  const leaves = await fetchApprovedLeavesOverlapping(uniqueIds, fromStart, toStart)

  const leavesByMember = new Map<string, typeof leaves>()
  for (const leave of leaves) {
    const list = leavesByMember.get(leave.memberId) ?? []
    list.push(leave)
    leavesByMember.set(leave.memberId, list)
  }

  const result: ExpectedHoursBatch = new Map()
  for (const memberId of uniqueIds) {
    const memberLeaves = leavesByMember.get(memberId) ?? []
    const byDay = new Map<string, ExpectedHoursDay>()
    let cursor = fromStart
    while (businessDayKey(cursor) <= businessDayKey(toStart)) {
      const day = computeExpectedHoursForDay(cursor, memberLeaves)
      byDay.set(day.dateKey, day)
      cursor = nextBusinessDayStart(cursor)
    }
    result.set(memberId, byDay)
  }
  return result
}

/** Sum expected hours over weekday keys for one member from a batch result. */
export function sumExpectedHoursForKeys(
  batch: ExpectedHoursBatch,
  memberId: string,
  dateKeys: string[],
): number {
  const byDay = batch.get(memberId)
  if (!byDay) {
    return Math.round(dateKeys.length * STANDARD_DAY_HOURS * 10) / 10
  }
  let sum = 0
  for (const key of dateKeys) {
    const day = byDay.get(key)
    sum += day ? day.expectedHours : STANDARD_DAY_HOURS
  }
  return Math.round(sum * 10) / 10
}
