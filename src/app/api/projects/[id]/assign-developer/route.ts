import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { notifyProjectAssigned } from '@/lib/notify'
import { replaceProjectAssignees, uniqueMemberIds } from '@/lib/project-assignees'
import { invalidateProjectsListCache } from '@/lib/cache-tags'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Manager', 'BD', 'Both'])
  if (deny) return deny

  const body = await req.json()
  const developerIds = uniqueMemberIds(body.developerIds ?? (body.developerId ? [body.developerId] : []))

  if (!developerIds.length) {
    return NextResponse.json({ error: 'Select at least one assigned person.' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      developerId: true,
      developer: { select: { name: true } },
      assignees: { select: { memberId: true, member: { select: { name: true } } } },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const members = await prisma.teamMember.findMany({
    where: { id: { in: developerIds }, active: true },
    select: { id: true, name: true },
  })
  if (members.length !== developerIds.length) {
    return NextResponse.json({ error: 'Select active team members only.' }, { status: 400 })
  }

  const previousIds = [
    ...new Set([project.developerId, ...project.assignees.map(a => a.memberId)]),
  ]
  const primaryId = developerIds[0]
  const namesById = Object.fromEntries(members.map(m => [m.id, m.name]))

  await prisma.project.update({
    where: { id: params.id },
    data: { developerId: primaryId },
  })
  await replaceProjectAssignees(params.id, developerIds)

  const session = await auth()
  const newlyAssigned = developerIds.filter(id => !previousIds.includes(id))
  await notifyProjectAssigned(
    newlyAssigned,
    session?.user?.id,
    project.name,
    `/projects/${project.id}`
  )

  await logAudit({
    action: 'updated',
    entityType: 'Project',
    entityId: project.id,
    entityName: project.name,
    changes: {
      assignees: {
        old: [project.developer.name, ...project.assignees.map(a => a.member.name)]
          .filter((name, i, arr) => arr.indexOf(name) === i)
          .join(', '),
        new: developerIds.map(id => namesById[id]).join(', '),
      },
    },
  })

  invalidateProjectsListCache()
  return NextResponse.json({ success: true })
}
