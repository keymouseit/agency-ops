import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { notifyProjectAssigned } from '@/lib/notify'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Manager', 'BD', 'Both'])
  if (deny) return deny

  const { developerId } = await req.json()

  if (!developerId || typeof developerId !== 'string') {
    return NextResponse.json({ error: 'Developer is required.' }, { status: 400 })
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      developerId: true,
      developer: { select: { name: true } },
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const newDeveloper = await prisma.teamMember.findUnique({
    where: { id: developerId },
    select: { id: true, name: true, role: true, active: true },
  })

  if (!newDeveloper?.active || !['Dev', 'Both'].includes(newDeveloper.role)) {
    return NextResponse.json({ error: 'Select an active developer.' }, { status: 400 })
  }

  if (newDeveloper.id === project.developerId) {
    return NextResponse.json({ success: true })
  }

  await prisma.project.update({
    where: { id: params.id },
    data: { developerId: newDeveloper.id },
  })

  const session = await auth()
  await notifyProjectAssigned(
    [newDeveloper.id],
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
      developer: {
        old: project.developer.name,
        new: newDeveloper.name,
      },
    },
  })

  return NextResponse.json({ success: true })
}
