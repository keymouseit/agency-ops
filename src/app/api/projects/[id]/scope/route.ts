import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['Dev', 'Both', 'Founder'])
  if (deny) return deny

  try {
    const data = await req.json()

    // Get project info for audit trail
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true },
    })

    const sc = await prisma.scopeChange.create({
      data: {
        projectId: params.id,
        requestedBy: data.requestedBy || 'client',
        description: data.description,
        hoursAdded: data.hoursAdded ? parseFloat(data.hoursAdded) : null,
        valueAdded: data.valueAdded ? parseFloat(data.valueAdded) : null,
        changeOrderSigned: data.changeOrderSigned === 'true' || data.changeOrderSigned === true,
        approvedById: data.approvedById || null,
      },
    })

    // Log audit trail
    await logAudit({
      action: 'created',
      entityType: 'ScopeChange',
      entityId: sc.id,
      entityName: project?.name || 'Unknown Project',
      metadata: {
        projectId: params.id,
        requestedBy: sc.requestedBy,
        hoursAdded: sc.hoursAdded,
        valueAdded: sc.valueAdded,
        changeOrderSigned: sc.changeOrderSigned,
        approvedById: sc.approvedById,
        hasUnsignedChangeOrder: !sc.changeOrderSigned,
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(sc)
  } catch (error) {
    logger.error('Failed to create scope change', error as Error)
    throw error
  }
}
