import { prisma } from '@/lib/prisma'
import { businessDayKey, businessDayStart } from '@/lib/daily'

export type OnLeaveTodayPerson = {
  leaveId: string
  memberId: string
  name: string
  role: string
  leaveType: string
  timeSlot: string | null
  label: string
}

function leaveTypeLabel(leaveType: string, timeSlot: string | null): string {
  if (leaveType === 'short_leave') {
    const slot = timeSlot ? timeSlot.replace(/_/g, ' ') : ''
    return slot ? `Short leave · ${slot}` : 'Short leave'
  }
  if (leaveType === 'half_day') {
    const slot = timeSlot ? timeSlot.replace(/_/g, ' ') : ''
    return slot ? `Half day · ${slot}` : 'Half day'
  }
  if (leaveType === 'birthday_leave') return 'Birthday leave'
  if (leaveType === 'work_from_home') return 'Work from home'
  return 'Full day'
}

function nextBusinessDayStart(from = new Date()): Date {
  const key = businessDayKey(from)
  const [y, m, d] = key.split('-').map(Number)
  // Construct noon IST on that day, then +1 calendar day → next business midnight
  const noonIst = new Date(Date.UTC(y, m - 1, d, 6, 30)) // 12:00 IST = 06:30 UTC
  noonIst.setUTCDate(noonIst.getUTCDate() + 1)
  return businessDayStart(noonIst)
}

/** Approved leaves that cover today's business day (Asia/Kolkata). */
export async function getApprovedOnLeaveToday(): Promise<OnLeaveTodayPerson[]> {
  const todayStart = businessDayStart()
  const dayAfterStart = nextBusinessDayStart()

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'approved',
      startDate: { lt: dayAfterStart },
      endDate: { gte: todayStart },
    },
    include: {
      member: { select: { id: true, name: true, role: true, active: true } },
    },
    orderBy: [{ leaveType: 'asc' }, { startDate: 'asc' }],
  })

  return leaves
    .filter(l => l.member.active)
    .map(l => ({
      leaveId: l.id,
      memberId: l.member.id,
      name: l.member.name,
      role: l.member.role,
      leaveType: l.leaveType,
      timeSlot: l.timeSlot,
      label: leaveTypeLabel(l.leaveType, l.timeSlot),
    }))
}
