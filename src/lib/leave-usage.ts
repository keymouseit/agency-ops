import { prisma } from '@/lib/prisma'
import { countWorkingDays, leavePaidDeduction, leaveUnpaidDays } from '@/lib/leave-math'

export type LeaveUsageSummary = {
  fullDayCount: number
  fullDayDays: number
  halfDayCount: number
  halfDayDays: number
  shortLeaveCount: number
  birthdayLeaveCount: number
  compOffLeaveCount: number
  workFromHomeCount: number
  unpaidCount: number
  totalDayBalance: number
  unpaidDayBalance: number
  takenDays: number
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
  let compOffLeaveCount = 0
  let workFromHomeCount = 0
  let unpaidCount = 0
  let totalDayBalance = 0
  let unpaidDayBalance = 0

  const rows = leaves.map(l => {
    const unpaid = l.unpaid === true || (l.unpaidDays ?? 0) > 0
    const paidDays = Number(l.paidDays ?? 0)
    const storedUnpaidDays = Number(l.unpaidDays ?? 0)
    if (unpaid) unpaidCount += 1

    const splitLeave = {
      leaveType: l.leaveType,
      startDate: l.startDate,
      endDate: l.endDate,
      unpaid,
      paidDays,
      unpaidDays: storedUnpaidDays,
    }

    let days = 0
    if (l.leaveType === 'short_leave') {
      shortLeaveCount += 1
      days = 0
    } else if (l.leaveType === 'birthday_leave') {
      birthdayLeaveCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
    } else if (l.leaveType === 'comp_off_leave') {
      compOffLeaveCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
    } else if (l.leaveType === 'work_from_home') {
      workFromHomeCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
    } else if (l.leaveType === 'half_day') {
      halfDayCount += 1
      days = 0.5
      totalDayBalance += leavePaidDeduction({ ...splitLeave, leaveType: 'half_day' })
      unpaidDayBalance += leaveUnpaidDays({ ...splitLeave, leaveType: 'half_day' })
    } else {
      fullDayCount += 1
      days = countWorkingDays(new Date(l.startDate), new Date(l.endDate))
      totalDayBalance += leavePaidDeduction({ ...splitLeave, leaveType: l.leaveType })
      unpaidDayBalance += leaveUnpaidDays({ ...splitLeave, leaveType: l.leaveType })
      fullDayDays += days
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
      unpaidDays: storedUnpaidDays || leaveUnpaidDays(splitLeave),
      days,
    }
  })

  const halfDayDays = halfDayCount * 0.5
  const paid = Number(totalDayBalance.toFixed(2))
  const unpaidTaken = Number(unpaidDayBalance.toFixed(2))
  return {
    fullDayCount,
    fullDayDays: Number(fullDayDays.toFixed(2)),
    halfDayCount,
    halfDayDays,
    shortLeaveCount,
    birthdayLeaveCount,
    compOffLeaveCount,
    workFromHomeCount,
    unpaidCount,
    totalDayBalance: paid,
    unpaidDayBalance: unpaidTaken,
    takenDays: Number((fullDayDays + halfDayDays).toFixed(2)),
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
