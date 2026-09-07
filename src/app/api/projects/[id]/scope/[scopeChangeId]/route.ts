import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notify'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; scopeChangeId: string } }
) {
  let userInfo
  try {
    userInfo = await requireRole(['BD', 'Both', 'Founder', 'Manager'])
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
    const decision = data.decision

    if (decision !== 'approved' && decision !== 'declined') {
      return NextResponse.json(
        { error: 'Decision must be approved or declined.' },
        { status: 400 }
      )
    }

    const scopeChange = await prisma.scopeChange.findUnique({
      where: { id: params.scopeChangeId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            bdMemberId: true,
            developerId: true,
          },
        },
      },
    })

    if (!scopeChange || scopeChange.projectId !== params.id) {
      return NextResponse.json({ error: 'Scope change not found.' }, { status: 404 })
    }

    const canDecide =
      userInfo.role === 'Founder' ||
      userInfo.role === 'Manager' ||
      scopeChange.project.bdMemberId === userInfo.memberId

    if (!canDecide) {
      return NextResponse.json(
        { error: 'Only the assigned BD, Founder, or Manager can decide this scope change.' },
        { status: 403 }
      )
    }

    if (scopeChange.approvalStatus !== 'pending') {
      return NextResponse.json(
        { error: 'This scope change has already been decided.' },
        { status: 409 }
      )
    }

    const updated = await prisma.scopeChange.update({
      where: { id: scopeChange.id },
      data: {
        approvalStatus: decision,
        ...(decision === 'approved' ? { changeOrderSigned: true } : {}),
        approvedById: userInfo.memberId,
        decidedAt: new Date(),
        decisionNote: data.decisionNote || null,
      },
    })

    await notify(
      decision === 'approved' ? 'scope_change_approved' : 'scope_change_declined',
      [scopeChange.project.developerId],
      `Scope change ${decision} for ${scopeChange.project.name}: ${scopeChange.description}`,
      `/projects/${scopeChange.project.id}`
    )

    await logAudit({
      action: decision === 'approved' ? 'approved' : 'rejected',
      entityType: 'ScopeChange',
      entityId: scopeChange.id,
      entityName: scopeChange.project.name,
      changes: {
        approvalStatus: {
          old: scopeChange.approvalStatus,
          new: decision,
        },
        ...(decision === 'approved'
          ? {
              changeOrderSigned: {
                old: scopeChange.changeOrderSigned,
                new: true,
              },
            }
          : {}),
      },
      metadata: {
        projectId: scopeChange.project.id,
        decisionNote: updated.decisionNote,
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(updated)
  } catch (error) {
    logger.error('Failed to decide scope change', error as Error)
    return NextResponse.json(
      { error: 'Failed to decide scope change.' },
      { status: 500 }
    )
  }
}
