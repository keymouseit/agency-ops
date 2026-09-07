import { auth } from '@/lib/auth'
import { sendLeaveApprovalEmail, sendLeaveRejectedEmail } from '@/lib/notifications'
import { addEventToGoogleCalendar } from '@/lib/gcal'
import { notify } from '@/lib/notify'
import { runInBackground } from '@/lib/background'
import { leavePaidDeduction } from '@/lib/leave-balance'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ALLOWED = ['Founder', 'HR', 'Manager']

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    if (!session.user.role || !ALLOWED.includes(session.user.role)) {
      return NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 })
    }

    const approvedById = session.user.id
    const actorLabel = 'Management'
    const { id } = params
    const body = await request.json()
    const { status, approvalNotes } = body

    if (!status || !['approved', 'rejected', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (!(typeof approvalNotes === 'string' && approvalNotes.trim())) {
      return NextResponse.json(
        { error: status === 'rejected' ? 'Rejection reason is required' : 'Approval comment is required' },
        { status: 400 }
      )
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { member: true },
    })

    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }
    if (leave.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending leave requests can be decided' }, { status: 400 })
    }

    const notes = approvalNotes.trim()
    const isShortLeave = leave.leaveType === 'short_leave'
    const deduction =
      status === 'approved' && !isShortLeave ? leavePaidDeduction(leave) : 0
    const year = new Date(leave.startDate).getFullYear()

    const updatedLeave = await prisma.$transaction(async tx => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status,
          approvedById,
          approvalNotes: notes,
          approvedAt: new Date(),
        },
        include: { member: true },
      })

      await tx.auditLog.create({
        data: {
          userId: approvedById,
          action: 'status_changed',
          entityType: 'LeaveRequest',
          entityId: updated.id,
          entityName: `${leave.member.name} leave request`,
          changes: JSON.stringify({ status: { old: leave.status, new: status } }),
          metadata: JSON.stringify({
            notes,
            by: actorLabel,
            actorId: approvedById,
            unpaid: leave.unpaid,
            paidDays: leave.paidDays,
            unpaidDays: leave.unpaidDays,
            deduction,
          }),
        },
      })

      if (status === 'approved') {
        if (isShortLeave) {
          await tx.leaveBalance.upsert({
            where: { memberId_year: { memberId: leave.memberId, year } },
            update: { shortLeaves: { increment: 1 } },
            create: { memberId: leave.memberId, year, shortLeaves: 1, used: 0, accrued: 0 },
          })
        } else if (deduction > 0) {
          await tx.leaveBalance.upsert({
            where: { memberId_year: { memberId: leave.memberId, year } },
            update: { used: { increment: deduction } },
            create: { memberId: leave.memberId, year, used: deduction, accrued: 0 },
          })
        }
      }

      return updated
    })

    const notesPart = ` — ${notes}`
    runInBackground(
      (async () => {
        if (status === 'approved') {
          await notify(
            'leave_approved',
            [leave.memberId],
            `Management approved your leave request${notesPart}`,
            '/leaves'
          )
          await sendLeaveApprovalEmail(updatedLeave, actorLabel)
          await addEventToGoogleCalendar(updatedLeave)
        } else if (status === 'rejected') {
          await notify(
            'leave_rejected',
            [leave.memberId],
            `Management rejected your leave request${notesPart}`,
            '/leaves'
          )
          await sendLeaveRejectedEmail(updatedLeave, actorLabel)
        }
      })(),
      `leave-${status}-side-effects`
    )

    return NextResponse.json(updatedLeave)
  } catch (error: unknown) {
    console.error('Error updating leave status:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
