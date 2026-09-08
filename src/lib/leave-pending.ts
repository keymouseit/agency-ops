import { prisma } from '@/lib/prisma'
import { leaveTypeLabel } from '@/lib/leave-today'
import { formatIstLeaveRange } from '@/lib/ist'

export type PendingLeaveRequest = {
  id: string
  memberName: string
  memberRole: string
  leaveType: string
  timeSlot: string | null
  label: string
  dateLabel: string
  reason: string | null
  unpaid: boolean
  paidDays: number
  unpaidDays: number
  appliedAt: string
}

/** Pending leave requests waiting on HR / management approval. Not cached. */
export async function getPendingLeaveRequests(): Promise<PendingLeaveRequest[]> {
  const leaves = await prisma.leaveRequest.findMany({
    where: { status: 'pending' },
    include: {
      member: { select: { name: true, role: true, active: true } },
    },
    orderBy: { appliedAt: 'asc' },
  })

  return leaves
    .filter(l => l.member.active)
    .map(l => ({
      id: l.id,
      memberName: l.member.name,
      memberRole: l.member.role,
      leaveType: l.leaveType,
      timeSlot: l.timeSlot,
      label: leaveTypeLabel(l.leaveType, l.timeSlot),
      dateLabel: formatIstLeaveRange(l.startDate, l.endDate),
      reason: l.reason,
      unpaid: l.unpaid,
      paidDays: l.paidDays,
      unpaidDays: l.unpaidDays,
      appliedAt: l.appliedAt.toISOString(),
    }))
}
