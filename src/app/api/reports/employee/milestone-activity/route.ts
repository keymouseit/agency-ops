import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { businessDayKey, businessDayStart } from '@/lib/daily'
import { differenceInCalendarDays } from 'date-fns'
import { MILESTONE_STATUS_CONFIG } from '@/lib/milestone-qa'

export const dynamic = 'force-dynamic'

/**
 * Milestone activity for the Individual report drawer.
 * DailyTask has no milestoneId — we show this person's project tasks in the
 * milestone window (prev due → due/completed), with an explicit note.
 */
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const memberId = searchParams.get('memberId')
  const milestoneId = searchParams.get('milestoneId')
  const fromStr = searchParams.get('from')
  const toStr = searchParams.get('to')
  const allTime = searchParams.get('allTime') === '1'

  if (!memberId || !milestoneId) {
    return NextResponse.json({ error: 'memberId and milestoneId are required' }, { status: 400 })
  }

  const role = session.user.role
  const allowed =
    ['Founder', 'Manager', 'HR'].includes(role) || memberId === session.user.id
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      completedAt: true,
      qaStartedAt: true,
      notes: true,
      project: { select: { id: true, name: true } },
      testCases: {
        select: {
          id: true,
          title: true,
          status: true,
          testedAt: true,
          notes: true,
          testedBy: { select: { id: true, name: true } },
        },
        orderBy: { sortOrder: 'asc' },
      },
      bugs: {
        select: {
          id: true,
          title: true,
          status: true,
          severity: true,
          createdAt: true,
          resolvedAt: true,
          reportedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!milestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }

  // Sibling milestones to infer a start window (prev due → this due)
  const siblings = await prisma.milestone.findMany({
    where: { projectId: milestone.project.id },
    select: { id: true, dueDate: true, title: true },
    orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
  })
  const idx = siblings.findIndex(s => s.id === milestone.id)
  const prev = idx > 0 ? siblings[idx - 1] : null

  const windowStart = prev?.dueDate
    ? businessDayStart(prev.dueDate)
    : fromStr
      ? businessDayStart(fromStr)
      : null
  const windowEnd = milestone.completedAt
    ? businessDayStart(milestone.completedAt)
    : milestone.dueDate
      ? businessDayStart(milestone.dueDate)
      : toStr
        ? businessDayStart(toStr)
        : businessDayStart()

  const rangeFrom = allTime
    ? windowStart
    : fromStr
      ? businessDayStart(fromStr)
      : windowStart
  const rangeTo = allTime
    ? windowEnd
    : toStr
      ? businessDayStart(toStr)
      : windowEnd

  // Intersect report range with milestone window when not allTime
  let taskFrom = rangeFrom
  let taskTo = rangeTo
  if (!allTime && windowStart && rangeFrom && rangeFrom < windowStart) taskFrom = windowStart
  if (!allTime && windowEnd && rangeTo && rangeTo > windowEnd) taskTo = windowEnd

  const today = businessDayStart()
  const daysLate =
    milestone.dueDate && milestone.status !== 'done' && milestone.dueDate < today
      ? differenceInCalendarDays(today, milestone.dueDate)
      : null

  const statusCfg = MILESTONE_STATUS_CONFIG[milestone.status] ?? {
    label: milestone.status,
    cls: 'bg-gray-100 text-gray-600',
  }

  // Project tasks by this person in the window (no direct milestoneId on DailyTask)
  const logs =
    taskFrom && taskTo
      ? await prisma.dailyLog.findMany({
          where: {
            memberId,
            date: { gte: taskFrom, lte: taskTo },
            tasks: { some: { projectId: milestone.project.id } },
          },
          include: {
            tasks: {
              where: { projectId: milestone.project.id },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { date: 'desc' },
        })
      : []

  const byDate = logs.map(l => {
    const hours = Math.round(l.tasks.reduce((s, t) => s + (t.actualHours ?? 0), 0) * 10) / 10
    return {
      date: l.date.toISOString(),
      dateKey: businessDayKey(l.date),
      hours,
      tasks: l.tasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        hours: t.actualHours ?? t.estimatedHours ?? 0,
        estimatedHours: t.estimatedHours,
        actualHours: t.actualHours,
      })),
    }
  })

  // Project blockers raised by this person overlapping the window
  const blockers = await prisma.blocker.findMany({
    where: {
      memberId,
      projectId: milestone.project.id,
      ...(taskFrom && taskTo
        ? { raisedAt: { gte: taskFrom, lte: new Date(taskTo.getTime() + 86400000) } }
        : {}),
    },
    orderBy: { raisedAt: 'desc' },
    take: 30,
    select: {
      id: true,
      description: true,
      status: true,
      category: true,
      raisedAt: true,
      resolvedAt: true,
    },
  })

  // Test cycles on the project in the window (no milestone FK — contextual only)
  const testCycles = await prisma.testCycle.findMany({
    where: {
      projectId: milestone.project.id,
      ...(taskFrom && taskTo
        ? { startedAt: { gte: taskFrom, lte: new Date(taskTo.getTime() + 86400000) } }
        : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      cycleType: true,
      result: true,
      startedAt: true,
      completedAt: true,
      summary: true,
      conductedBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    milestone: {
      id: milestone.id,
      title: milestone.title,
      status: milestone.status,
      statusLabel: statusCfg.label,
      statusCls: statusCfg.cls,
      dueDate: milestone.dueDate?.toISOString() ?? null,
      completedAt: milestone.completedAt?.toISOString() ?? null,
      qaStartedAt: milestone.qaStartedAt?.toISOString() ?? null,
      daysLate,
      notes: milestone.notes,
      project: milestone.project,
    },
    linkMode: 'project_window' as const,
    linkNote:
      "Tasks aren't linked to milestones directly; showing this person's work on the project during the milestone window.",
    window: {
      start: taskFrom?.toISOString() ?? null,
      end: taskTo?.toISOString() ?? null,
      prevMilestoneTitle: prev?.title ?? null,
      allTime,
    },
    days: byDate,
    qa: {
      testCases: milestone.testCases.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        testedAt: t.testedAt?.toISOString() ?? null,
        notes: t.notes,
        testedBy: t.testedBy,
      })),
      bugs: milestone.bugs.map(b => ({
        id: b.id,
        title: b.title,
        status: b.status,
        severity: b.severity,
        createdAt: b.createdAt.toISOString(),
        resolvedAt: b.resolvedAt?.toISOString() ?? null,
        reportedBy: b.reportedBy,
      })),
      testCycles: testCycles.map(c => ({
        id: c.id,
        cycleType: c.cycleType,
        result: c.result,
        startedAt: c.startedAt.toISOString(),
        completedAt: c.completedAt?.toISOString() ?? null,
        summary: c.summary,
        conductedBy: c.conductedBy,
      })),
    },
    blockers: blockers.map(b => ({
      id: b.id,
      description: b.description,
      status: b.status,
      category: b.category,
      raisedAt: b.raisedAt.toISOString(),
      resolvedAt: b.resolvedAt?.toISOString() ?? null,
    })),
  })
}
