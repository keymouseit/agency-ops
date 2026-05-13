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
    const lead = await prisma.lead.create({
      data: {
        clientName: data.clientName,
        source: data.source,
        description: data.description || null,
        budget: data.budget ? parseFloat(data.budget) : null,
        currency: data.currency || 'USD',
        ownerId: data.ownerId,
      },
    })

    // Log audit trail
    await logAudit({
      action: 'created',
      entityType: 'Lead',
      entityId: lead.id,
      entityName: lead.clientName,
      metadata: {
        source: lead.source,
        budget: lead.budget,
        currency: lead.currency,
        ownerId: lead.ownerId,
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(lead)
  } catch (error) {
    logger.error('Failed to create lead', error as Error)
    throw error
  }
}
