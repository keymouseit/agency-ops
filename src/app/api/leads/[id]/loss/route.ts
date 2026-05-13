import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit, getClientIP } from '@/lib/audit'
import { logger } from '@/lib/logger'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const deny = await checkRole(['BD', 'Both', 'Founder', 'Manager'])
  if (deny) return deny

  try {
    const data = await req.json()

    // Get lead info for audit trail
    const lead = await prisma.lead.findUnique({
      where: { id: params.id },
      select: { clientName: true },
    })

    // Check if analysis already exists
    const existingAnalysis = await prisma.lossAnalysis.findUnique({
      where: { leadId: params.id },
    })

    const analysis = await prisma.lossAnalysis.upsert({
      where: { leadId: params.id },
      update: {
        reason: data.reason, faultArea: data.faultArea,
        faultOwnerId: data.faultOwnerId || null,
        notes: data.notes || null, competitorWon: data.competitorWon || null,
        lessonsLearned: data.lessonsLearned || null,
      },
      create: {
        leadId: params.id, reason: data.reason, faultArea: data.faultArea,
        faultOwnerId: data.faultOwnerId || null,
        notes: data.notes || null, competitorWon: data.competitorWon || null,
        lessonsLearned: data.lessonsLearned || null,
      },
    })

    // Log audit trail
    await logAudit({
      action: existingAnalysis ? 'updated' : 'created',
      entityType: 'LossAnalysis',
      entityId: analysis.id,
      entityName: lead?.clientName || 'Unknown Lead',
      metadata: {
        leadId: params.id,
        reason: data.reason,
        faultArea: data.faultArea,
        competitorWon: data.competitorWon,
        hasLessons: !!data.lessonsLearned,
      },
      ipAddress: getClientIP(req),
      userAgent: req.headers.get('user-agent') || undefined,
    }).catch(err => logger.error('Failed to log audit trail', err))

    return NextResponse.json(analysis)
  } catch (error) {
    logger.error('Failed to save loss analysis', error as Error)
    throw error
  }
}
