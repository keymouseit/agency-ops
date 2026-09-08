import { notifyProjectAssigned } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidateProjectsListCache } from '@/lib/cache-tags'

export async function POST(req: Request) {
  const deny = await checkRole(['BD', 'Dev', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  const data = await req.json()
  const session = await auth()
  const creatorId = session?.user?.id

  // Validate estimated hours
  if (data.estimatedHours && parseFloat(data.estimatedHours) <= 0) {
    return NextResponse.json(
      { error: 'Estimated hours must be greater than 0' },
      { status: 400 }
    )
  }

  if (!data.developerId || typeof data.developerId !== 'string') {
    return NextResponse.json({ error: 'Assigned person is required.' }, { status: 400 })
  }

  const assignee = await prisma.teamMember.findUnique({
    where: { id: data.developerId },
    select: { id: true, active: true },
  })
  if (!assignee?.active) {
    return NextResponse.json({ error: 'Select an active team member.' }, { status: 400 })
  }

  const project = await prisma.project.create({
    data: {
      name: data.name,
      leadId: data.leadId || null,
      developerId: assignee.id,
      bdMemberId: data.bdMemberId || null,
      clientName: data.clientName || null,
      contractValue: data.contractValue ? parseFloat(data.contractValue) : null,
      currency: data.currency || 'USD',
      estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
      techStack: data.techStack || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      estimatedEnd: data.estimatedEnd ? new Date(data.estimatedEnd) : null,
    },
  })

  await notifyProjectAssigned(
    [assignee.id, data.bdMemberId],
    creatorId,
    data.name,
    `/projects/${project.id}`
  )

  invalidateProjectsListCache()
  return NextResponse.json(project)
}
