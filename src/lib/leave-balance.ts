import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns'
import { istYearAndMonth } from '@/lib/ist'
import {
  BIRTHDAY_LEAVE_YEARLY_CAP,
  MAX_ANNUAL_LEAVE_DAYS,
  SHORT_LEAVE_MONTHLY_CAP,
  accrualMonthsForYear,
  compOffRequestDayCost,
  leaveRequestDayCost,
  monthlyAccrualStep,
  splitPaidUnpaid,
} from '@/lib/leave-math'

export {
  BIRTHDAY_LEAVE_YEARLY_CAP,
  SHORT_LEAVE_MONTHLY_CAP,
  accrualMonthsForYear,
  compOffRequestDayCost,
  countWorkingDays,
  leavePaidDeduction,
  leaveRequestDayCost,
  splitPaidUnpaid,
} from '@/lib/leave-math'

/**
 * Accrue 1 leave day per calendar month.
 * New rows start at months-so-far. Existing Totals are never reset — from the
 * 1st of each later month we add +1 (max 12). HR edits to Total are kept.
 */
export async function ensureMonthlyAccrual(memberId: string, year = istYearAndMonth().year) {
  const { month: istMonth } = istYearAndMonth()
  const monthTarget = accrualMonthsForYear(new Date(), year)

  const existing = await prisma.leaveBalance.findUnique({
    where: { memberId_year: { memberId, year } },
  })

  if (!existing) {
    return prisma.leaveBalance.create({
      data: {
        memberId,
        year,
        accrued: monthTarget,
        used: 0,
        shortLeaves: 0,
        accruedThroughMonth: year === istYearAndMonth().year ? istMonth : monthTarget,
      },
    })
  }

  const step = monthlyAccrualStep(existing.accruedThroughMonth, year)
  if (step.initialize) {
    return prisma.leaveBalance.update({
      where: { id: existing.id },
      data: { accruedThroughMonth: step.month },
    })
  }
  if (step.monthsDue <= 0) return existing

  if (existing.accrued >= MAX_ANNUAL_LEAVE_DAYS) {
    return prisma.leaveBalance.update({
      where: { id: existing.id },
      data: { accruedThroughMonth: step.month },
    })
  }

  const nextAccrued = Math.min(
    MAX_ANNUAL_LEAVE_DAYS,
    Number((existing.accrued + step.monthsDue).toFixed(2))
  )
  return prisma.leaveBalance.update({
    where: { id: existing.id },
    data: {
      accrued: nextAccrued,
      accruedThroughMonth: step.month,
    },
  })
}

export async function accrueMonthlyLeaveForAllActive() {
  const { year } = istYearAndMonth()
  const members = await prisma.teamMember.findMany({
    where: { active: true },
    select: { id: true },
  })
  for (const m of members) {
    await ensureMonthlyAccrual(m.id, year)
  }
  return { year, members: members.length }
}

/**
 * Ensure short leaves are tracked as a count (not days in `used`).
 * One-time correction: move previously deducted 0.25/day short leaves out of `used`.
 */
export async function syncShortLeaveBalance(memberId: string, year = istYearAndMonth().year) {
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
    const { month } = istYearAndMonth()
    return prisma.leaveBalance.create({
      data: {
        memberId,
        year,
        shortLeaves: shortLeaveCount,
        used: 0,
        accrued: monthTarget,
        accruedThroughMonth: year === istYearAndMonth().year ? month : monthTarget,
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
export async function getAvailableLeaveDays(memberId: string, year = istYearAndMonth().year) {
  const balance = await syncShortLeaveBalance(memberId, year)
  return {
    balance,
    available: Math.max(0, Number((balance.accrued - balance.used).toFixed(2))),
  }
}

/** Remaining Comp Off days (HR-granted favour — separate from regular leave). */
export async function getAvailableCompOffDays(memberId: string, year = istYearAndMonth().year) {
  const balance = await syncShortLeaveBalance(memberId, year)
  const accrued = Number(balance.compOffAccrued ?? 0)
  const used = Number(balance.compOffUsed ?? 0)

  const yearStart = startOfYear(new Date(year, 0, 1))
  const yearEnd = endOfYear(new Date(year, 0, 1))
  const pending = await prisma.leaveRequest.findMany({
    where: {
      memberId,
      leaveType: 'comp_off_leave',
      status: 'pending',
      startDate: { gte: yearStart, lte: yearEnd },
    },
    select: { startDate: true, endDate: true, timeSlot: true },
  })
  const pendingCost = pending.reduce(
    (sum, l) =>
      sum + compOffRequestDayCost(new Date(l.startDate), new Date(l.endDate), l.timeSlot),
    0
  )

  return {
    balance,
    accrued,
    used,
    pending: Number(pendingCost.toFixed(2)),
    available: Math.max(0, Number((accrued - used - pendingCost).toFixed(2))),
  }
}

export async function assertNoOverlappingLeave(opts: {
  memberId: string
  startDate: Date
  endDate: Date
  leaveType?: string
  excludeId?: string
}) {
  if (opts.leaveType === 'work_from_home') return

  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      memberId: opts.memberId,
      status: { in: ['pending', 'approved'] },
      leaveType: { not: 'work_from_home' },
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
  endDate?: Date
  timeSlot?: string | null
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


  if (opts.leaveType === 'comp_off_leave') {
    // Same simple flow as birthday: employee applies, HR approves. No pre-assigned credit required.
    const cost = compOffRequestDayCost(opts.startDate, opts.endDate ?? opts.startDate, opts.timeSlot)
    if (cost <= 0) {
      throw Object.assign(new Error('Comp Off leave must cover at least one working day'), {
        status: 400,
      })
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
