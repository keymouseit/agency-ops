import { isSameDay } from 'date-fns'

export const SHORT_LEAVE_MONTHLY_CAP = 2
export const BIRTHDAY_LEAVE_YEARLY_CAP = 1

/** Count Mon–Fri inclusive between two dates (weekends excluded). */
export function countWorkingDays(startDate: Date, endDate: Date): number {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(0, 0, 0, 0)
  if (end < start) return 0

  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count += 1
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/** Working-day cost of a leave request (short/birthday/WFH = 0). */
export function leaveRequestDayCost(
  leaveType: string,
  startDate: Date,
  endDate: Date
): number {
  if (
    leaveType === 'short_leave' ||
    leaveType === 'birthday_leave' ||
    leaveType === 'work_from_home'
  ) {
    return 0
  }
  if (leaveType === 'half_day') return 0.5
  if (isSameDay(startDate, endDate)) {
    const day = startDate.getDay()
    return day === 0 || day === 6 ? 0 : 1
  }
  return countWorkingDays(startDate, endDate)
}

/** Split a request across remaining paid balance. */
export function splitPaidUnpaid(dayCost: number, available: number) {
  const avail = Math.max(0, Number(available.toFixed(2)))
  const cost = Math.max(0, Number(dayCost.toFixed(2)))
  const paidDays = Math.min(cost, avail)
  const unpaidDays = Math.max(0, Number((cost - paidDays).toFixed(2)))
  return {
    paidDays: Number(paidDays.toFixed(2)),
    unpaidDays,
    unpaid: unpaidDays > 0,
  }
}

/**
 * Months of accrual earned for a year, prorated from join date (TeamMember.createdAt).
 * 1 day per calendar month from join month through current month (or Dec for past years).
 */
export function accrualMonthsForYear(
  joinedAt: Date,
  year: number,
  asOf = new Date()
): number {
  const joinYear = joinedAt.getFullYear()
  const joinMonth = joinedAt.getMonth() + 1 // 1–12
  const asOfYear = asOf.getFullYear()
  const asOfMonth = asOf.getMonth() + 1

  if (year < joinYear) return 0
  if (year > asOfYear) return 0

  if (year < asOfYear) {
    if (year > joinYear) return 12
    return Math.max(0, 12 - joinMonth + 1)
  }

  if (joinYear < year) {
    return asOfMonth
  }
  return Math.max(0, asOfMonth - joinMonth + 1)
}

/** Paid days actually deducted on approval (supports legacy rows). */
export function leavePaidDeduction(leave: {
  leaveType: string
  startDate: Date
  endDate: Date
  unpaid: boolean
  paidDays?: number | null
  unpaidDays?: number | null
}): number {
  if (
    leave.leaveType === 'short_leave' ||
    leave.leaveType === 'birthday_leave' ||
    leave.leaveType === 'work_from_home'
  ) {
    return 0
  }
  const paid = leave.paidDays ?? 0
  const unpaidPart = leave.unpaidDays ?? 0
  if (paid > 0 || unpaidPart > 0 || leave.unpaid) {
    return Number(paid.toFixed(2))
  }
  return leaveRequestDayCost(leave.leaveType, new Date(leave.startDate), new Date(leave.endDate))
}
