import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const deny = await checkRole(['Founder'])
  if (deny) return deny

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
      { status: 500 }
    )
  }
}
