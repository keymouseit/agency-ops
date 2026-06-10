import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notify'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Use requireRole to get the user's role
  let userInfo
  try {
    userInfo = await requireRole(['Dev', 'Both', 'Founder', 'BD'])
  } catch (e: unknown) {
    const err = e as { message: string; status?: number }
    const isUnauthed = err.message === 'UNAUTHORIZED'
    return NextResponse.json(
      { error: isUnauthed ? 'Sign in required.' : 'You do not have permission for this action.' },
      { status: isUnauthed ? 401 : 403 }
    )
  }

  try {
    const data = await req.json()

    // Developers cannot set monetary values - only Founders and BD
    if (userInfo.role === 'Dev' && data.valueAdded) {
      return NextResponse.json(
        { error: 'Developers cannot set monetary values for scope changes. Only Founders and BD can set valueAdded.' },
        { status: 403 }
      )
    }

    // Get project info for audit trail
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, bdMemberId: true, developerId: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    const sc = await prisma.scopeChange.create({
      data: {
        projectId: params.id,
        requestedBy: data.requestedBy || 'client',
        description: data.description,
        hoursAdded: data.hoursAdded ? parseFloat(data.hoursAdded) : null,
        valueAdded: data.valueAdded && userInfo.role !== 'Dev' ? parseFloat(data.valueAdded) : null,
        changeOrderSigned: data.changeOrderSigned === 'true' || data.changeOrderSigned === true,
        approvalStatus: 'pending',
      },
    })

    const founders = await prisma.teamMember.findMany({
      where: { role: 'Founder', active: true },
      select: { id: true },
    })
    const approverIds = Array.from(new Set([
      project.bdMemberId,
      ...founders.map(founder => founder.id),
    ].filter((id): id is string => Boolean(id))))

    if (approverIds.length > 0) {
      await notify(
        'scope_change_requested',
        approverIds,
        `Scope change needs approval for ${project.name}: ${sc.description}`,
        `/projects/${project.id}`
      )
    }

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
        approvalStatus: sc.approvalStatus,
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
