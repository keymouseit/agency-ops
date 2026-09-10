import { NextResponse } from 'next/server'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { notifyProjectAssigned } from '@/lib/notify'
import { invalidateProjectCaches } from '@/lib/cache-tags'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Founder', 'Manager'])
  if (deny) return deny

  const { bdMemberId } = await req.json()

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, bdMemberId: true }
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const oldBDMemberId = project.bdMemberId
  const newBDMemberId = bdMemberId || null

  await prisma.project.update({
    where: { id: params.id },
    data: { bdMemberId: newBDMemberId },
  })

  const session = await auth()
  if (newBDMemberId && newBDMemberId !== oldBDMemberId) {
    await notifyProjectAssigned(
      [newBDMemberId],
      session?.user?.id,
      project.name,
      `/projects/${project.id}`
    )
  }

  // Log the change
  await logAudit({
    action: 'updated',
    entityType: 'Project',
    entityId: project.id,
    entityName: project.name,
    changes: {
      bdMemberId: {
        old: oldBDMemberId || 'None',
        new: newBDMemberId || 'None'
      }
    }
  })

  invalidateProjectCaches(params.id)
  return NextResponse.json({ success: true })
}
