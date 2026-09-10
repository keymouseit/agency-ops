import { NextResponse } from 'next/server'
import { auth, checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { logProjectQAActivity } from '@/lib/qa-audit'
import type { QAEventType } from '@/lib/qa-audit-format'
import type { AuditAction } from '@/lib/audit'
import { invalidateProjectCaches } from '@/lib/cache-tags'
import { isMilestoneStatus } from '@/lib/milestone-qa'

function milestoneStatusAudit(
  fromStatus: string,
  toStatus: string,
): { action: AuditAction; qaEventType: QAEventType } {
  if (toStatus === 'in_progress' && fromStatus === 'pending') {
    return { action: 'status_changed', qaEventType: 'milestone_started' }
  }
  if (toStatus === 'ready_for_qa' && fromStatus !== 'ready_for_qa') {
    return { action: 'status_changed', qaEventType: 'milestone_ready_for_qa' }
  }
  if (toStatus === 'testing' && fromStatus === 'ready_for_qa') {
    return { action: 'updated', qaEventType: 'milestone_testing_started' }
  }
  if (toStatus === 'done' && fromStatus !== 'done') {
    return { action: 'approved', qaEventType: 'milestone_approved' }
  }
  return { action: 'status_changed', qaEventType: 'milestone_status_changed' }
}

function canEditMilestoneContent(
  createdById: string | null | undefined,
  userId: string | undefined,
  userRole: string | undefined,
) {
  if (!userId) return false
  if (createdById && createdById === userId) return true
  // Founder can manage orphaned milestones (created before createdBy was tracked)
  if (userRole === 'Founder' && !createdById) return true
  return false
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'QA', 'Both', 'Founder', 'BD', 'Manager'])
  if (deny) return deny

  const session = await auth()
  const userId = session?.user?.id
  const userRole = session?.user?.role
  const data = await req.json()

  if (data.status != null && !isMilestoneStatus(data.status)) {
    return NextResponse.json({ error: 'Invalid milestone status' }, { status: 400 })
  }

  const existingMilestone = await prisma.milestone.findUnique({
    where: { id: params.id },
    include: { project: true },
  })

  if (!existingMilestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }

  const editingContent =
    data.title !== undefined || data.notes !== undefined || data.dueDate !== undefined

  if (editingContent) {
    if (!canEditMilestoneContent(existingMilestone.createdById, userId, userRole)) {
      return NextResponse.json(
        { error: 'Only the person who created this milestone can edit it' },
        { status: 403 },
      )
    }
    if (existingMilestone.status !== 'pending') {
      return NextResponse.json(
        { error: 'Only not-started milestones can be edited' },
        { status: 400 },
      )
    }
  }

  if (data.status != null && !['Dev', 'QA', 'Both', 'Founder'].includes(userRole || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const previousStatus = existingMilestone.status
  const nextStatus = data.status ?? previousStatus
  const statusChanged = data.status != null && data.status !== previousStatus

  const updateData: {
    status?: string
    title?: string
    notes?: string | null
    dueDate?: Date | null
    completedAt?: Date | null
    qaStartedAt?: Date | null
    qaStartedById?: string | null
  } = {}

  if (data.status != null) {
    updateData.status = data.status
    updateData.completedAt = data.status === 'done' ? new Date() : null
    if (data.status === 'testing' && previousStatus === 'ready_for_qa') {
      updateData.qaStartedAt = new Date()
    }
    if (data.status === 'pending' || data.status === 'in_progress') {
      updateData.qaStartedAt = null
      updateData.qaStartedById = null
    }
  }

  if (typeof data.title === 'string') {
    const title = data.title.trim()
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }
    updateData.title = title
  }

  if (data.notes !== undefined) {
    const notes = typeof data.notes === 'string' ? data.notes.trim() : ''
    updateData.notes = notes || null
  }

  if (data.dueDate !== undefined) {
    if (data.dueDate === null || data.dueDate === '') {
      updateData.dueDate = null
    } else {
      const dueDate = new Date(String(data.dueDate))
      if (Number.isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: 'Invalid due date' }, { status: 400 })
      }
      updateData.dueDate = dueDate
    }
  }

  const milestone = await prisma.milestone.update({
    where: { id: params.id },
    data: updateData,
  })

  if (statusChanged) {
    const { action, qaEventType } = milestoneStatusAudit(previousStatus, nextStatus)
    await logProjectQAActivity(
      action,
      existingMilestone.projectId,
      existingMilestone.project.name,
      {
        qaEventType,
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
        fromStatus: previousStatus,
        toStatus: nextStatus,
      },
      req,
    )
  } else if (editingContent) {
    await logProjectQAActivity(
      'updated',
      existingMilestone.projectId,
      existingMilestone.project.name,
      {
        qaEventType: 'milestone_updated',
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      },
      req,
    )
  }

  if (nextStatus === 'testing' && previousStatus !== 'testing') {
    await notify(
      'milestone_testing_started',
      [existingMilestone.project.developerId],
      `QA started testing milestone: ${milestone.title} in ${existingMilestone.project.name}`,
      `/projects/${existingMilestone.projectId}#qa`
    )
  }

  if (nextStatus === 'done' && previousStatus !== 'done') {
    await notify(
      'milestone_qa_approved',
      [existingMilestone.project.developerId],
      `Milestone QA approved: ${milestone.title} in ${existingMilestone.project.name}`,
      `/projects/${existingMilestone.projectId}#qa`
    )
  }

  if (nextStatus === 'ready_for_qa' && previousStatus !== 'ready_for_qa') {
    const qaMembers = await prisma.teamMember.findMany({
      where: { role: { in: ['QA', 'Both'] }, active: true },
      select: { id: true },
    })

    if (qaMembers.length) {
      await notify(
        'milestone_ready_for_qa',
        qaMembers.map(m => m.id),
        `Milestone ready: ${milestone.title} in ${existingMilestone.project.name}`,
        `/qa/${existingMilestone.projectId}`
      )
    }
  }

  invalidateProjectCaches(existingMilestone.projectId)
  return NextResponse.json(milestone)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Dev', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const session = await auth()
  const userId = session?.user?.id
  const userRole = session?.user?.role

  const existingMilestone = await prisma.milestone.findUnique({
    where: { id: params.id },
    include: { project: { select: { id: true, name: true } } },
  })

  if (!existingMilestone) {
    return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  }

  if (!canEditMilestoneContent(existingMilestone.createdById, userId, userRole)) {
    return NextResponse.json(
      { error: 'Only the person who created this milestone can delete it' },
      { status: 403 },
    )
  }

  if (existingMilestone.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only not-started milestones can be deleted' },
      { status: 400 },
    )
  }

  await prisma.milestone.delete({ where: { id: params.id } })

  await logProjectQAActivity(
    'deleted',
    existingMilestone.project.id,
    existingMilestone.project.name,
    {
      qaEventType: 'milestone_deleted',
      milestoneId: existingMilestone.id,
      milestoneTitle: existingMilestone.title,
    },
    req,
  )

  invalidateProjectCaches(existingMilestone.project.id)
  return NextResponse.json({ success: true })
}
