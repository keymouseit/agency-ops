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
    const record = await prisma.estimationRecord.update({
      where: { id: params.recordId },
      data: { bdApprovedAt: new Date() },
    })
    await prisma.estimationRequest.update({
      where: { id: record.requestId },
      data: { status: 'approved' },
    })

    // Get lead info for notification and audit
    const req = await prisma.estimationRequest.findUnique({
      where: { id: record.requestId },
      include: { lead: { select: { clientName: true } } },
    })

    // Notify the dev estimator their work was approved
    if (req) {
      await notify('estimate_approved', [req.assignedTo],
        `Your estimate for ${req.lead.clientName} was approved by BD`,
        `/estimate/${req.leadId}`)
    }

    // Log audit trail
    await logAudit({
      action: 'approved',
      entityType: 'EstimationRecord',
      entityId: record.id,
      entityName: req?.lead.clientName || 'Unknown Lead',
      metadata: {
        requestId: record.requestId,
        leadId: req?.leadId,
        totalPrice: record.totalPriceFinal,
        totalHours: record.totalHoursFinal,
        ratePerHour: record.ratePerHour,
      },
      ipAddress: getClientIP(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(record)
  } catch (error) {
    logger.error('Failed to approve estimate', error as Error)
    throw error
  }
}
