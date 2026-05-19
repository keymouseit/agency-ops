import { notify } from '@/lib/notify'
import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  try {
    const data = await req.json()
    const request = await prisma.estimationRequest.create({
      data: {
        leadId: data.leadId,
        requestedBy: data.requestedBy,
        assignedTo: data.assignedTo,
        notes: data.notes || null,
        dueBy: data.dueBy ? new Date(data.dueBy) : null,
        status: 'pending',
      },
    })

    // Get names for notification and audit
    const requester = await prisma.teamMember.findUnique({ where: { id: data.requestedBy }, select: { name: true } })
    const assignee = await prisma.teamMember.findUnique({ where: { id: data.assignedTo }, select: { name: true } })
    const lead = await prisma.lead.findUnique({ where: { id: data.leadId }, select: { clientName: true } })

    // Notify the assigned developer
    if (data.assignedTo && requester && lead) {
      await notify('estimate_requested', [data.assignedTo],
        `${requester.name} has requested an estimate for ${lead.clientName}`,
        `/estimate/${data.leadId}`)
    }

    // Log audit trail
    await logAudit({
      action: 'created',
      entityType: 'Estimate',
      entityId: request.id,
      entityName: lead?.clientName || 'Unknown Lead',
      metadata: {
        leadId: data.leadId,
        assignedTo: data.assignedTo,
        assigneeName: assignee?.name,
        requestedBy: data.requestedBy,
        requesterName: requester?.name,
        dueBy: data.dueBy,
        hasNotes: !!data.notes,
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(request)
  } catch (error) {
    logger.error('Failed to create estimation request', error as Error)
    throw error
  }
}
