import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns'
import {
  BIRTHDAY_LEAVE_YEARLY_CAP,
  SHORT_LEAVE_MONTHLY_CAP,
  accrualMonthsForYear,
  leaveRequestDayCost,
  splitPaidUnpaid,
} from '@/lib/leave-math'

export {
  BIRTHDAY_LEAVE_YEARLY_CAP,
  SHORT_LEAVE_MONTHLY_CAP,
  accrualMonthsForYear,
  countWorkingDays,
  leavePaidDeduction,
  leaveRequestDayCost,
  splitPaidUnpaid,
} from '@/lib/leave-math'

/**
 * Accrue 1 leave day per calendar month so far this year when a balance row is first created.
 * Do not overwrite Accrued after that — HR may set a lower value for mid-year joiners.
 */
export async function ensureMonthlyAccrual(memberId: string, year = new Date().getFullYear()) {
  const existing = await prisma.leaveBalance.findUnique({
    where: { memberId_year: { memberId, year } },
  })
  if (existing) return existing

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { createdAt: true },
  })
  const joinedAt = member?.createdAt ?? new Date()
  const monthTarget = accrualMonthsForYear(joinedAt, year)

  return prisma.leaveBalance.create({
    data: { memberId, year, accrued: monthTarget, used: 0, shortLeaves: 0 },
  })
}

/**
 * Ensure short leaves are tracked as a count (not days in `used`).
 * One-time correction: move previously deducted 0.25/day short leaves out of `used`.
 */
export async function syncShortLeaveBalance(memberId: string, year = new Date().getFullYear()) {
  await ensureMonthlyAccrual(memberId, year)

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 0, 1))

  const shortLeaveCount = await prisma.leaveRequest.count({
    where: {
      memberId,
      status: 'approved',
      leaveType: 'short_leave',
      startDate: { gte: yearStart, lte: yearEnd },
    },
  })

  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { createdAt: true },
  })
  const joinedAt = member?.createdAt ?? new Date()
  const monthTarget = accrualMonthsForYear(joinedAt, year)

  const existing = await prisma.leaveBalance.findUnique({
    where: { memberId_year: { memberId, year } },
  })

  if (!existing) {
    return prisma.leaveBalance.create({
      data: {
        memberId,
        year,
        shortLeaves: shortLeaveCount,
        used: 0,
        accrued: monthTarget,
      },
    })
  }

  if (existing.shortLeaves === shortLeaveCount) {
    return existing
  }

  const previouslyUntracked = existing.shortLeaves === 0 && shortLeaveCount > 0
  const usedCorrection = previouslyUntracked
    ? Math.max(0, Number((existing.used - shortLeaveCount * 0.25).toFixed(2)))
    : existing.used

  return prisma.leaveBalance.update({
    where: { id: existing.id },
    data: {
      shortLeaves: shortLeaveCount,
      used: usedCorrection,
    },
  })
}

/** Remaining paid leave days after accrual sync (does not reserve pending). */
export async function getAvailableLeaveDays(memberId: string, year = new Date().getFullYear()) {
  const balance = await syncShortLeaveBalance(memberId, year)
  return {
    balance,
    available: Math.max(0, Number((balance.accrued - balance.used).toFixed(2))),
  }
}

export async function assertNoOverlappingLeave(opts: {
  memberId: string
  startDate: Date
  endDate: Date
  excludeId?: string
}) {
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      memberId: opts.memberId,
      status: { in: ['pending', 'approved'] },
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      startDate: { lte: opts.endDate },
      endDate: { gte: opts.startDate },
    },
    select: { id: true, startDate: true, endDate: true, status: true, leaveType: true },
  })
  if (overlap) {
    throw Object.assign(
      new Error(
        `Overlaps an existing ${overlap.status} ${overlap.leaveType.replace(/_/g, ' ')} leave`
      ),
      { status: 400 }
    )
  }
}

export async function assertLeaveTypePolicy(opts: {
  memberId: string
  leaveType: string
  startDate: Date
  excludeId?: string
}) {
  if (opts.leaveType === 'birthday_leave') {
    const year = opts.startDate.getFullYear()
    const yearStart = startOfYear(new Date(year, 0, 1))
    const yearEnd = endOfYear(new Date(year, 0, 1))
    const count = await prisma.leaveRequest.count({
      where: {
        memberId: opts.memberId,
        leaveType: 'birthday_leave',
        status: { in: ['pending', 'approved'] },
        startDate: { gte: yearStart, lte: yearEnd },
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
    })
    if (count >= BIRTHDAY_LEAVE_YEARLY_CAP) {
      throw Object.assign(
        new Error(`Only ${BIRTHDAY_LEAVE_YEARLY_CAP} birthday leave allowed per year`),
        { status: 400 }
      )
    }
  }

  if (opts.leaveType === 'short_leave') {
    const monthStart = startOfMonth(opts.startDate)
    const monthEnd = endOfMonth(opts.startDate)
    const count = await prisma.leaveRequest.count({
      where: {
        memberId: opts.memberId,
        leaveType: 'short_leave',
        status: { in: ['pending', 'approved'] },
        startDate: { gte: monthStart, lte: monthEnd },
        ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
      },
    })
    if (count >= SHORT_LEAVE_MONTHLY_CAP) {
      throw Object.assign(
        new Error(`Only ${SHORT_LEAVE_MONTHLY_CAP} short leaves allowed per month`),
        { status: 400 }
      )
    }
  }
}

export async function computeLeaveBalanceSplit(
  memberId: string,
  leaveType: string,
  startDate: Date,
  endDate: Date
) {
  const dayCost = leaveRequestDayCost(leaveType, startDate, endDate)
  if (dayCost <= 0) {
    return { dayCost: 0, paidDays: 0, unpaidDays: 0, unpaid: false }
  }
  const { available } = await getAvailableLeaveDays(memberId)
  const split = splitPaidUnpaid(dayCost, available)
  return { dayCost, ...split }
}
