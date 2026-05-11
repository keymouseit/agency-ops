import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole, getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()
  const session = await getSession()
  const creatorId = session?.user?.id

  const project = await prisma.project.create({
    data: {
      name: data.name,
      leadId: data.leadId || null,
      ownerId: data.ownerId,
      clientName: data.clientName || null,
      contractValue: data.contractValue ? parseFloat(data.contractValue) : null,
      currency: data.currency || 'USD',
      estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
      techStack: data.techStack || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      estimatedEnd: data.estimatedEnd ? new Date(data.estimatedEnd) : null,
    },
  })

  // Notify the assigned developer if they're not the creator
  if (data.ownerId && creatorId && data.ownerId !== creatorId) {
    const creator = await prisma.teamMember.findUnique({ where: { id: creatorId }, select: { name: true } })
    if (creator) {
      await notify('project_assigned', [data.ownerId],
        `${creator.name} assigned you to project: ${data.name}`,
        `/projects/${project.id}`)
    }
  }

  return NextResponse.json(project)
}
