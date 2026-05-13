import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST(request: Request, { params }: { params: { recordId: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  try {
    const { note } = await request.json()
    const record = await prisma.estimationRecord.update({
      where: { id: params.recordId },
      data: { bdRevisionNote: note, devConfirmedAt: null },
    })
    await prisma.estimationRequest.update({
      where: { id: record.requestId },
      data: { status: 'revision' },
    })

    // Get lead info for notification and audit
    const estReq = await prisma.estimationRequest.findUnique({
      where: { id: record.requestId },
      include: { lead: { select: { clientName: true } } },
    })

    // Notify the dev estimator
    if (estReq) {
      await notify(
        'estimate_revision',
        [estReq.assignedTo],
        `BD sent your estimate for ${estReq.lead.clientName} back for revision: ${note.slice(0, 80)}`,
        `/estimate/${estReq.leadId}`
      )
    }

    // Log audit trail
    await logAudit({
      action: 'revision_requested',
      entityType: 'EstimationRecord',
      entityId: record.id,
      entityName: estReq?.lead.clientName || 'Unknown Lead',
      metadata: {
        requestId: record.requestId,
        leadId: estReq?.leadId,
        revisionNote: note,
        devConfirmationCleared: true,
      },
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(record)
  } catch (error) {
    logger.error('Failed to request estimate revision', error as Error)
    throw error
  }
}
