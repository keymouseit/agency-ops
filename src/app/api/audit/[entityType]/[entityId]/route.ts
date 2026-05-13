import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(
  req: Request,
  { params }: { params: { entityType: string; entityId: string } }
) {
  const startTime = Date.now()

  // All authenticated users can view entity-specific audit logs
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'Manager'])
  if (deny) {
    logger.logApiResponse('GET', `/api/audit/${params.entityType}/${params.entityId}`, deny.status, Date.now() - startTime)
    return deny
  }

  logger.logApiRequest('GET', `/api/audit/${params.entityType}/${params.entityId}`, undefined)
  logger.debug('Fetching entity audit logs', { entityType: params.entityType, entityId: params.entityId })

  try {
    // Fetch logs for specific entity
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: params.entityType,
        entityId: params.entityId,
      },
      orderBy: { timestamp: 'desc' },
      take: 100, // Limit to last 100 entries
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Parse JSON fields
    const logsWithParsedJson = logs.map(log => ({
      ...log,
      changes: log.changes ? JSON.parse(log.changes) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }))

    logger.info('Entity audit logs fetched', {
      entityType: params.entityType,
      entityId: params.entityId,
      count: logs.length,
    })
    logger.logApiResponse('GET', `/api/audit/${params.entityType}/${params.entityId}`, 200, Date.now() - startTime)

    return NextResponse.json({
      logs: logsWithParsedJson,
      count: logs.length,
    })
  } catch (error) {
    logger.error('Failed to fetch entity audit logs', error as Error, {
      entityType: params.entityType,
      entityId: params.entityId,
    })
    logger.logApiResponse('GET', `/api/audit/${params.entityType}/${params.entityId}`, 500, Date.now() - startTime)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
