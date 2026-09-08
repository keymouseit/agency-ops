import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { logProjectQAActivity } from '@/lib/qa-audit'
import { invalidateProjectsListCache } from '@/lib/cache-tags'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  // Get milestone with project info before update
  const existingMilestone = await prisma.milestone.findUnique({
    where: { id: params.id },
    include: { project: true },
  })

  const milestone = await prisma.milestone.update({
    where: { id: params.id },
    data: {
      status: data.status,
      completedAt: data.status === 'done' ? new Date() : null,
      ...(data.status === 'testing' && existingMilestone?.status === 'ready_for_qa'
        ? { qaStartedAt: new Date() }
        : {}),
      ...(data.status === 'pending'
        ? { qaStartedAt: null, qaStartedById: null }
        : {}),
    },
  })

  // Notify developer when QA starts testing
  if (data.status === 'testing' && existingMilestone?.status !== 'testing' && existingMilestone) {
    await notify(
      'milestone_testing_started',
      [existingMilestone.project.developerId],
      `QA started testing milestone: ${milestone.title} in ${existingMilestone.project.name}`,
      `/projects/${existingMilestone.projectId}#qa`
    )
    await logProjectQAActivity(
      'updated',
      existingMilestone.projectId,
      existingMilestone.project.name,
      {
        qaEventType: 'milestone_testing_started',
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      },
      req,
    )
  }

  // Notify developer when milestone is approved
  if (data.status === 'done' && existingMilestone?.status !== 'done' && existingMilestone) {
    await notify(
      'milestone_qa_approved',
      [existingMilestone.project.developerId],
      `Milestone QA approved: ${milestone.title} in ${existingMilestone.project.name}`,
      `/projects/${existingMilestone.projectId}#qa`
    )
    await logProjectQAActivity(
      'approved',
      existingMilestone.projectId,
      existingMilestone.project.name,
      {
        qaEventType: 'milestone_approved',
        milestoneId: milestone.id,
        milestoneTitle: milestone.title,
      },
      req,
    )
  }

  // Send notification to QA team when milestone moves to "ready_for_qa"
  if (data.status === 'ready_for_qa' && existingMilestone?.status !== 'ready_for_qa') {
    const qaMembers = await prisma.teamMember.findMany({
      where: { role: { in: ['QA', 'Both'] }, active: true },
      select: { id: true },
    })

    if (qaMembers.length && existingMilestone) {
      await notify(
        'milestone_ready_for_qa',
        qaMembers.map(m => m.id),
        `Milestone ready: ${milestone.title} in ${existingMilestone.project.name}`,
        `/qa/${existingMilestone.projectId}`
      )
    }

    if (existingMilestone) {
      await logProjectQAActivity(
        'status_changed',
        existingMilestone.projectId,
        existingMilestone.project.name,
        {
          qaEventType: 'milestone_ready_for_qa',
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
        },
        req,
      )
    }
  }

  invalidateProjectsListCache()
  return NextResponse.json(milestone)
}
