import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

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

  return NextResponse.json({ success: true })
}
