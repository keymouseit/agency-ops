import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  assertLeaveTypePolicy,
  assertNoOverlappingLeave,
  computeLeaveBalanceSplit,
} from '@/lib/leave-balance'
import { revalidateLeavePages } from '@/lib/cache-tags'

const ADMIN_ROLES = ['Founder', 'HR', 'Manager']

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const { leaveType, startDate, endDate, reason, timeSlot } = body

    const existingLeave = await prisma.leaveRequest.findUnique({
      where: { id },
    })

    if (!existingLeave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    const isOwner = existingLeave.memberId === session.user.id
    const isAdmin = ADMIN_ROLES.includes(session.user.role || '')
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You cannot edit this leave request.' }, { status: 403 })
    }

    if (existingLeave.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending leaves can be edited' }, { status: 400 })
    }

    const nextType = leaveType ?? existingLeave.leaveType
    const nextStart = startDate ? new Date(startDate) : existingLeave.startDate
    const nextEnd = endDate ? new Date(endDate) : existingLeave.endDate
    if (Number.isNaN(nextStart.getTime()) || Number.isNaN(nextEnd.getTime()) || nextEnd < nextStart) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    await assertNoOverlappingLeave({
      memberId: existingLeave.memberId,
      startDate: nextStart,
      endDate: nextEnd,
      excludeId: id,
    })
    await assertLeaveTypePolicy({
      memberId: existingLeave.memberId,
      leaveType: nextType,
      startDate: nextStart,
      excludeId: id,
    })

    const split = await computeLeaveBalanceSplit(
      existingLeave.memberId,
      nextType,
      nextStart,
      nextEnd
    )

    const updatedLeave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        leaveType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        reason,
        timeSlot,
        unpaid: split.unpaid,
        paidDays: split.paidDays,
        unpaidDays: split.unpaidDays,
      },
    })

    const changes: Record<string, any> = {}
    if (existingLeave.leaveType !== updatedLeave.leaveType)
      changes.leaveType = { old: existingLeave.leaveType, new: updatedLeave.leaveType }
    if (existingLeave.startDate.toISOString() !== updatedLeave.startDate.toISOString())
      changes.startDate = { old: existingLeave.startDate, new: updatedLeave.startDate }
    if (existingLeave.endDate.toISOString() !== updatedLeave.endDate.toISOString())
      changes.endDate = { old: existingLeave.endDate, new: updatedLeave.endDate }
    if (existingLeave.reason !== updatedLeave.reason)
      changes.reason = { old: existingLeave.reason, new: updatedLeave.reason }
    if (existingLeave.timeSlot !== updatedLeave.timeSlot)
      changes.timeSlot = { old: existingLeave.timeSlot, new: updatedLeave.timeSlot }
    if (existingLeave.unpaid !== updatedLeave.unpaid)
      changes.unpaid = { old: existingLeave.unpaid, new: updatedLeave.unpaid }
    if (existingLeave.paidDays !== updatedLeave.paidDays)
      changes.paidDays = { old: existingLeave.paidDays, new: updatedLeave.paidDays }
    if (existingLeave.unpaidDays !== updatedLeave.unpaidDays)
      changes.unpaidDays = { old: existingLeave.unpaidDays, new: updatedLeave.unpaidDays }

    if (Object.keys(changes).length > 0) {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'updated',
          entityType: 'LeaveRequest',
          entityId: updatedLeave.id,
          entityName: 'Leave Request',
          changes: JSON.stringify(changes),
        },
      })
    }

    revalidateLeavePages()
    return NextResponse.json(updatedLeave, { status: 200 })
  } catch (error: unknown) {
    console.error('Error updating leave request:', error)
    const err = error as { message?: string; status?: number }
    if (err.status === 400) {
      return NextResponse.json({ error: err.message || 'Bad request' }, { status: 400 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const { id } = params
    const leave = await prisma.leaveRequest.findUnique({ where: { id } })
    if (!leave) {
      return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
    }

    const isOwner = leave.memberId === session.user.id
    const isAdmin = ADMIN_ROLES.includes(session.user.role || '')
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You cannot delete this leave request.' }, { status: 403 })
    }

    if (leave.status === 'approved') {
      return NextResponse.json(
        { error: 'Approved leaves cannot be deleted. Use Revoke instead.' },
        { status: 400 }
      )
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'deleted',
        entityType: 'LeaveRequest',
        entityId: leave.id,
        entityName: 'Leave Request',
        changes: JSON.stringify({
          status: leave.status,
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
        }),
      },
    })

    await prisma.leaveRequest.delete({ where: { id } })

    revalidateLeavePages()
    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    console.error('Error deleting leave request:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
