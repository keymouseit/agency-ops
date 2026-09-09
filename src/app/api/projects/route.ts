import { notifyProjectAssigned } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidateProjectsListCache } from '@/lib/cache-tags'
import { replaceProjectAssignees, uniqueMemberIds } from '@/lib/project-assignees'

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

  const developerIds = uniqueMemberIds(data.developerIds ?? (data.developerId ? [data.developerId] : []))
  if (!developerIds.length) {
    return NextResponse.json({ error: 'Select at least one assigned person.' }, { status: 400 })
  }

  const assignees = await prisma.teamMember.findMany({
    where: { id: { in: developerIds }, active: true },
    select: { id: true },
  })
  if (assignees.length !== developerIds.length) {
    return NextResponse.json({ error: 'Select active team members only.' }, { status: 400 })
  }

  const primaryId = developerIds[0]

  const project = await prisma.project.create({
    data: {
      name: data.name,
      leadId: data.leadId || null,
      developerId: primaryId,
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

  await replaceProjectAssignees(project.id, developerIds)

  await notifyProjectAssigned(
    [...developerIds, data.bdMemberId],
    creatorId,
    data.name,
    `/projects/${project.id}`
  )

  invalidateProjectsListCache()
  return NextResponse.json(project)
}
