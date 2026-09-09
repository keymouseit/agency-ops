import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, captureChanges, getClientIP } from '@/lib/audit'
import { canEditProject, canDeleteProject, projectEditFields, type ProjectEditField } from '@/lib/projects'
import { replaceProjectAssignees, uniqueMemberIds } from '@/lib/project-assignees'
import { invalidateProjectsListCache } from '@/lib/cache-tags'

function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isNaN(num) ? null : num
}

function parseOptionalDate(value: unknown): Date | null {
  if (!value || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  const userId = session?.user?.id
  const userRole = session?.user?.role

  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { assignees: { select: { memberId: true } } },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const assignment = {
    developerId: project.developerId,
    bdMemberId: project.bdMemberId,
    assigneeIds: project.assignees.map(a => a.memberId),
  }

  if (!canEditProject(assignment, userId, userRole)) {
    return NextResponse.json({ error: 'You do not have permission to edit this project.' }, { status: 403 })
  }

  const data = await req.json()
  const allowed = projectEditFields(assignment, userId, userRole)
  const updateData: Record<string, unknown> = {}

  const setIfAllowed = (field: ProjectEditField, value: unknown) => {
    if (!allowed.has(field)) return
    updateData[field] = value
  }

  if (data.name !== undefined) {
    const name = String(data.name).trim()
    if (!name) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
    }
    setIfAllowed('name', name)
  }

  if (data.leadId !== undefined) {
    const leadId = data.leadId || null
    if (leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { id: true, status: true, project: { select: { id: true } } },
      })
      if (!lead || lead.status !== 'won') {
        return NextResponse.json({ error: 'Select a valid won lead.' }, { status: 400 })
      }
      if (lead.project && lead.project.id !== project.id) {
        return NextResponse.json({ error: 'That lead is already linked to another project.' }, { status: 400 })
      }
    }
    setIfAllowed('leadId', leadId)
  }

  if (data.developerIds !== undefined || data.developerId !== undefined) {
    const developerIds = uniqueMemberIds(
      data.developerIds ?? (data.developerId ? [data.developerId] : [])
    )
    if (!developerIds.length) {
      return NextResponse.json({ error: 'Select at least one assigned person.' }, { status: 400 })
    }
    const members = await prisma.teamMember.findMany({
      where: { id: { in: developerIds }, active: true },
      select: { id: true },
    })
    if (members.length !== developerIds.length) {
      return NextResponse.json({ error: 'Select active team members only.' }, { status: 400 })
    }
    setIfAllowed('developerId', developerIds[0])
    if (allowed.has('developerId')) {
      await replaceProjectAssignees(params.id, developerIds)
    }
  }

  if (data.bdMemberId !== undefined) {
    const bdMemberId = data.bdMemberId || null
    if (bdMemberId) {
      const bd = await prisma.teamMember.findUnique({
        where: { id: bdMemberId },
        select: { id: true, role: true, active: true },
      })
      if (!bd?.active || !['BD', 'Both', 'Founder'].includes(bd.role)) {
        return NextResponse.json({ error: 'Select an active BD member.' }, { status: 400 })
      }
      setIfAllowed('bdMemberId', bd.id)
    } else {
      setIfAllowed('bdMemberId', null)
    }
  }

  if (data.clientName !== undefined) {
    setIfAllowed('clientName', data.clientName ? String(data.clientName).trim() : null)
  }

  if (data.contractValue !== undefined) {
    setIfAllowed('contractValue', parseOptionalNumber(data.contractValue))
  }

  if (data.currency !== undefined) {
    setIfAllowed('currency', String(data.currency))
  }

  if (data.estimatedHours !== undefined) {
    const hours = parseOptionalNumber(data.estimatedHours)
    if (hours !== null && hours <= 0) {
      return NextResponse.json({ error: 'Estimated hours must be greater than 0 when provided.' }, { status: 400 })
    }
    setIfAllowed('estimatedHours', hours)
  }

  if (data.actualHours !== undefined) {
    const hours = parseOptionalNumber(data.actualHours)
    if (hours !== null && hours < 0) {
      return NextResponse.json({ error: 'Actual hours cannot be negative.' }, { status: 400 })
    }
    setIfAllowed('actualHours', hours)
  }

  if (data.techStack !== undefined) {
    setIfAllowed('techStack', data.techStack ? String(data.techStack).trim() : null)
  }

  if (data.startDate !== undefined) {
    setIfAllowed('startDate', parseOptionalDate(data.startDate))
  }

  if (data.estimatedEnd !== undefined) {
    setIfAllowed('estimatedEnd', parseOptionalDate(data.estimatedEnd))
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No editable fields were provided.' }, { status: 400 })
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
  })
  invalidateProjectsListCache()

  const changes = captureChanges(project, updateData)
  if (Object.keys(changes).length > 0) {
    await logAudit({
      action: 'updated',
      entityType: 'Project',
      entityId: project.id,
      entityName: updated.name,
      changes,
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth()
  if (!canDeleteProject(session?.user?.role)) {
    return NextResponse.json({ error: 'You do not have permission for this action.' }, { status: 403 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    await prisma.$transaction(async (tx) => {
      const projectId = params.id

      await tx.releaseSignOff.deleteMany({ where: { projectId } })
      await tx.testCycle.deleteMany({ where: { projectId } })
      await tx.postDeliveryIssue.deleteMany({ where: { projectId } })
      await tx.postMortem.deleteMany({ where: { projectId } })
      await tx.blocker.deleteMany({ where: { projectId } })
      await tx.projectCheckIn.deleteMany({ where: { projectId } })
      await tx.scopeChange.deleteMany({ where: { projectId } })
      await tx.milestone.deleteMany({ where: { projectId } })
      await tx.projectHealthSnapshot.deleteMany({ where: { projectId } })
      await tx.dailyTask.updateMany({
        where: { projectId },
        data: { projectId: null },
      })
      await tx.project.delete({ where: { id: projectId } })
    })

    await logAudit({
      action: 'deleted',
      entityType: 'Project',
      entityId: project.id,
      entityName: project.name,
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete project. Please try again.' },
      { status: 500 },
    )
  }
}
