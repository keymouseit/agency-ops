import { prisma } from '@/lib/prisma'
import { businessDayKey, businessDayStart } from '@/lib/daily'
import { formatIstDate } from '@/lib/ist'
import { leaveTypeLabel } from '@/lib/leave-today'

/**
 * Daily Plan lock for approved FULL-DAY leave.
 *
 * An employee with an approved full-day leave on a business day cannot add
 * tasks to their Daily Plan (morning plan or EOD "Also completed today") for
 * that day. Management must revoke the leave first (status → "cancelled"),
 * after which planning works as usual.
 *
 * Blocks: full_day, birthday_leave, comp_off_leave (full day only).
 * Does NOT block: half_day, short_leave, work_from_home, comp-off on a half-day
 * slot, or any leave that is pending / rejected / cancelled.
 */

const HALF_DAY_SLOTS = new Set(['morning', 'afternoon', 'before_lunch', 'after_lunch', 'half_day'])

export function isFullDayBlockingLeave(leave: { leaveType: string; timeSlot: string | null }): boolean {
  if (leave.leaveType === 'full_day' || leave.leaveType === 'birthday_leave') return true
  if (leave.leaveType === 'comp_off_leave') {
    return !(leave.timeSlot && HALF_DAY_SLOTS.has(leave.timeSlot))
  }
  return false
}

export type PlanLeaveBlock = {
  leaveId: string
  leaveType: string
  label: string
  dateKey: string
  dateLabel: string
  message: string
}

function nextBusinessDayStart(from: Date): Date {
  const key = businessDayKey(from)
  const [y, m, d] = key.split('-').map(Number)
  const noonIst = new Date(Date.UTC(y, m - 1, d, 6, 30))
  noonIst.setUTCDate(noonIst.getUTCDate() + 1)
  return businessDayStart(noonIst)
}

export function planLeaveBlockMessage(dateLabel: string) {
  return `You're on approved leave on ${dateLabel}. Ask management to cancel your leave before adding tasks.`
}

/**
 * Returns the approved full-day leave covering `date` (IST business day) for
 * this member, or null when planning is allowed. Always reads live from the DB.
 */
export async function getPlanLeaveBlock(
  memberId: string,
  date: Date | string = new Date(),
): Promise<PlanLeaveBlock | null> {
  const dayStart = businessDayStart(date)
  const dayKey = businessDayKey(dayStart)
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      memberId,
      status: 'approved',
      startDate: { lt: nextBusinessDayStart(dayStart) },
      endDate: { gte: dayStart },
    },
    select: { id: true, leaveType: true, timeSlot: true, startDate: true, endDate: true },
    orderBy: { startDate: 'asc' },
  })

  const blocking = leaves.find(
    l =>
      isFullDayBlockingLeave(l) &&
      businessDayKey(l.startDate) <= dayKey &&
      businessDayKey(l.endDate) >= dayKey,
  )
  if (!blocking) return null

  const dateLabel = formatIstDate(dayStart)
  return {
    leaveId: blocking.id,
    leaveType: blocking.leaveType,
    label: leaveTypeLabel(blocking.leaveType, blocking.timeSlot),
    dateKey: dayKey,
    dateLabel,
    message: planLeaveBlockMessage(dateLabel),
  }
}
