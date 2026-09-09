import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendLeaveAppliedEmail } from '@/lib/notifications'
import { notify } from '@/lib/notify'
import { runInBackground } from '@/lib/background'
import { formatIstDate } from '@/lib/ist'
import { revalidateLeavePages } from '@/lib/cache-tags'
import {
  assertLeaveTypePolicy,
  assertNoOverlappingLeave,
  computeLeaveBalanceSplit,
} from '@/lib/leave-balance'

const ADMIN_ROLES = ['Founder', 'HR', 'Manager']

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const isAdmin = ADMIN_ROLES.includes(session.user.role || '')
    const requestedMemberId = searchParams.get('memberId')

    const whereClause: { memberId?: string; status?: string } = {}
    if (isAdmin) {
      if (requestedMemberId) whereClause.memberId = requestedMemberId
    } else {
      whereClause.memberId = session.user.id
    }
    if (status) whereClause.status = status

    const leaves = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        member: { select: { name: true, email: true } },
        approvedBy: { select: { name: true } },
      },
      orderBy: { startDate: 'desc' },
    })

    return NextResponse.json(leaves, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error: unknown) {
    console.error('Error fetching leaves:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    const body = await request.json()
    const { leaveType, startDate, endDate, reason, timeSlot } = body
    const sessionIsAdmin = ADMIN_ROLES.includes(session.user.role || '')
    const wantsAdminLog = body.isAdmin === true

    if (wantsAdminLog && !sessionIsAdmin) {
      return NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 })
    }

    const memberId =
      wantsAdminLog && sessionIsAdmin && typeof body.memberId === 'string'
        ? body.memberId
        : session.user.id

    if (!leaveType || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (!wantsAdminLog && start < today) {
      return NextResponse.json(
        { error: 'Standard employees can only apply for future dates' },
        { status: 400 }
      )
    }
    if (wantsAdminLog && !(typeof reason === 'string' && reason.trim())) {
      return NextResponse.json(
        { error: 'Reason is required when logging leave manually' },
        { status: 400 }
      )
    }

    await assertNoOverlappingLeave({ memberId, startDate: start, endDate: end, leaveType })
    await assertLeaveTypePolicy({ memberId, leaveType, startDate: start })

    const split = await computeLeaveBalanceSplit(memberId, leaveType, start, end)

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        memberId,
        leaveType,
        startDate: start,
        endDate: end,
        reason,
        timeSlot,
        unpaid: split.unpaid,
        paidDays: split.paidDays,
        unpaidDays: split.unpaidDays,
      },
      include: { member: true },
    })

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'created',
        entityType: 'LeaveRequest',
        entityId: leaveRequest.id,
        entityName: 'Leave Request',
        changes: JSON.stringify({
          status: 'pending',
          unpaid: split.unpaid,
          paidDays: split.paidDays,
          unpaidDays: split.unpaidDays,
        }),
      },
    })

    runInBackground(
      (async () => {
        const hrEmail = process.env.HR_EMAIL || process.env.SMTP_USER || 'hr@example.com'
        await sendLeaveAppliedEmail(leaveRequest, hrEmail)

        const reviewers = await prisma.teamMember.findMany({
          where: { active: true, role: { in: ['HR', 'Founder', 'Manager'] } },
          select: { id: true },
        })
        const reviewerIds = reviewers
          .map(r => r.id)
          .filter(id => id !== leaveRequest.memberId)
        if (!reviewerIds.length) return

        const startLabel = formatIstDate(leaveRequest.startDate)
        const endLabel = formatIstDate(leaveRequest.endDate)
        const typeLabel = leaveRequest.leaveType.replace(/_/g, ' ')
        let unpaidLabel = ''
        if (leaveRequest.unpaidDays > 0 && leaveRequest.paidDays > 0) {
          unpaidLabel = ` (partial unpaid: ${leaveRequest.paidDays} paid + ${leaveRequest.unpaidDays} unpaid)`
        } else if (leaveRequest.unpaid) {
          unpaidLabel = ' (unpaid)'
        }
        await notify(
          'leave_applied',
          reviewerIds,
          `${leaveRequest.member.name} applied for ${typeLabel} leave${unpaidLabel} — ${startLabel} to ${endLabel}`,
          '/leaves'
        )
      })(),
      'leave-applied-side-effects'
    )

    revalidateLeavePages()
    return NextResponse.json(leaveRequest, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating leave request:', error)
    const err = error as { message?: string; status?: number }
    if (err.status === 400) {
      return NextResponse.json({ error: err.message || 'Bad request' }, { status: 400 })
    }
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
