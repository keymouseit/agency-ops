import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { leavePaidDeduction } from '@/lib/leave-balance'
import { notify } from '@/lib/notify'
import { runInBackground } from '@/lib/background'
import { revalidateLeavePages } from '@/lib/cache-tags'

const ALLOWED = ['Founder', 'HR', 'Manager']

/** Revoke an approved leave and roll back paid balance / short-leave count. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }
    if (!session.user.role || !ALLOWED.includes(session.user.role)) {
      return NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : 'Revoked by management'

    const { id } = params
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { member: true },
    })

    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }
    if (leave.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved leaves can be revoked' }, { status: 400 })
    }

    const year = new Date(leave.startDate).getFullYear()
    const isShortLeave = leave.leaveType === 'short_leave'
    const deduction = leavePaidDeduction(leave)

    const updated = await prisma.$transaction(async tx => {
      const revoked = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'cancelled',
          approvalNotes: notes,
          approvedById: session.user!.id,
          approvedAt: new Date(),
        },
        include: { member: true },
      })

      await tx.auditLog.create({
        data: {
          userId: session.user!.id,
          action: 'status_changed',
          entityType: 'LeaveRequest',
          entityId: revoked.id,
          entityName: `${leave.member.name} leave request`,
          changes: JSON.stringify({ status: { old: 'approved', new: 'cancelled' } }),
          metadata: JSON.stringify({
            notes,
            by: 'Management',
            actorId: session.user!.id,
            revoked: true,
            deductionRolledBack: deduction,
            shortLeaveRolledBack: isShortLeave,
          }),
        },
      })

      if (isShortLeave) {
        const bal = await tx.leaveBalance.findUnique({
          where: { memberId_year: { memberId: leave.memberId, year } },
        })
        if (bal && bal.shortLeaves > 0) {
          await tx.leaveBalance.update({
            where: { id: bal.id },
            data: { shortLeaves: { decrement: 1 } },
          })
        }
      } else if (deduction > 0) {
        const bal = await tx.leaveBalance.findUnique({
          where: { memberId_year: { memberId: leave.memberId, year } },
        })
        if (bal) {
          await tx.leaveBalance.update({
            where: { id: bal.id },
            data: { used: Math.max(0, Number((bal.used - deduction).toFixed(2))) },
          })
        }
      }

      return revoked
    })

    runInBackground(
      (async () => {
        await notify(
          'leave_rejected',
          [leave.memberId],
          `Management revoked your approved leave — ${notes}`,
          '/leaves'
        )
      })(),
      'leave-revoke-side-effects'
    )

    revalidateLeavePages()
    return NextResponse.json(updated)
  } catch (error: unknown) {
    console.error('Error revoking leave:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
