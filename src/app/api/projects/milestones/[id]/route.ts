import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'

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
    },
  })

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
  }

  return NextResponse.json(milestone)
}
