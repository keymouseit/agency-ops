import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, captureChanges, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  try {
    const { status } = await req.json()

    // Get old data for change tracking
    const oldLead = await prisma.lead.findUnique({ where: { id: params.id } })
    if (!oldLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead = await prisma.lead.update({ where: { id: params.id }, data: { status } })

    // Log audit trail with status change
    const changes = captureChanges(oldLead, { status })
    await logAudit({
      action: 'status_changed',
      entityType: 'Lead',
      entityId: lead.id,
      entityName: lead.clientName,
      changes,
      metadata: {
        oldStatus: oldLead.status,
        newStatus: status,
        isWon: status === 'won',
        isLost: status === 'lost',
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(lead)
  } catch (error) {
    logger.error('Failed to update lead status', error as Error)
    throw error
  }
}
