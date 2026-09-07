import { prisma } from '@/lib/prisma'
import { countWorkingDays } from '@/lib/leave-math'

export type LeaveUsageSummary = {
  fullDayCount: number
  fullDayDays: number
  halfDayCount: number
  halfDayDays: number
  shortLeaveCount: number
  birthdayLeaveCount: number
  workFromHomeCount: number
  unpaidCount: number
  totalDayBalance: number
  totalRequests: number
  leaves: {
    id: string
    leaveType: string
    timeSlot: string | null
    startDate: string
    endDate: string
    reason: string | null
    status: string
    unpaid: boolean
    paidDays: number
    unpaidDays: number
    days: number
  }[]
}

export function summarizeLeaveUsage(
  leaves: {
    id: string
    leaveType: string
    timeSlot: string | null
    startDate: Date
    endDate: Date
    reason: string | null
    status: string
    unpaid?: boolean
    paidDays?: number | null
    unpaidDays?: number | null
  }[]
): LeaveUsageSummary {
  let fullDayCount = 0
  let fullDayDays = 0
  let halfDayCount = 0
  let shortLeaveCount = 0
  let birthdayLeaveCount = 0
  let workFromHomeCount = 0
  let unpaidCount = 0
  let totalDayBalance = 0

  const rows = leaves.map(l => {
    const unpaid = l.unpaid === true || (l.unpaidDays ?? 0) > 0
    const paidDays = Number(l.paidDays ?? 0)
    const unpaidDays = Number(l.unpaidDays ?? 0)
    if (unpaid) unpaidCount += 1

    let days = 0
    if (l.leaveType === 'short_leave') {
      shortLeaveCount += 1
      days = 0
    } else if (l.leaveType === 'birthday_leave') {
      birthdayLeaveCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
    } else if (l.leaveType === 'work_from_home') {
      workFromHomeCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
    } else if (l.leaveType === 'half_day') {
      halfDayCount += 1
      days = 0.5
      totalDayBalance += paidDays > 0 || unpaidDays > 0 || unpaid ? paidDays : 0.5
    } else {
      fullDayCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
      const balanceDays = paidDays > 0 || unpaidDays > 0 || unpaid ? paidDays : days
      totalDayBalance += balanceDays
      fullDayDays += balanceDays
    }

    return {
      id: l.id,
      leaveType: l.leaveType,
      timeSlot: l.timeSlot,
      startDate: new Date(l.startDate).toISOString(),
      endDate: new Date(l.endDate).toISOString(),
      reason: l.reason,
      status: l.status,
      unpaid,
      paidDays,
      unpaidDays,
      days,
    }
  })

  const halfDayDays = halfDayCount * 0.5
  return {
    fullDayCount,
    fullDayDays,
    halfDayCount,
    halfDayDays,
    shortLeaveCount,
    birthdayLeaveCount,
    workFromHomeCount,
    unpaidCount,
    totalDayBalance: Number(totalDayBalance.toFixed(2)),
    totalRequests: leaves.length,
    leaves: rows,
  }
}

export async function getEmployeeLeaveUsage(
  memberId: string,
  from: Date,
  to: Date
): Promise<LeaveUsageSummary> {
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      memberId,
      status: 'approved',
      startDate: { lte: to },
      endDate: { gte: from },
    },
    orderBy: { startDate: 'desc' },
    select: {
      id: true,
      leaveType: true,
      timeSlot: true,
      startDate: true,
      endDate: true,
      reason: true,
      status: true,
      unpaid: true,
      paidDays: true,
      unpaidDays: true,
    },
  })

  return summarizeLeaveUsage(leaves)
}
