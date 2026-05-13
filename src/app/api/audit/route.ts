import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  const startTime = Date.now()

  // Only Founder can view audit logs
  const deny = await checkRole(['Founder'])
  if (deny) {
    logger.logApiResponse('GET', '/api/audit', deny.status, Date.now() - startTime)
    return deny
  }

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const userId = searchParams.get('userId') || undefined
  const entityType = searchParams.get('entityType') || undefined
  const action = searchParams.get('action') || undefined
  const search = searchParams.get('search') || undefined
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined

  logger.logApiRequest('GET', '/api/audit', undefined)
  logger.debug('Fetching audit logs', {
    page,
    limit,
    filters: { userId, entityType, action, search, startDate, endDate },
  })

  try {
    // Build where clause
    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (action) {
      where.action = action
    }

    if (search) {
      // Search across entityName, userName, userEmail
      where.OR = [
        { entityName: { contains: search } },
        { userName: { contains: search } },
        { userEmail: { contains: search } },
      ]
    }

    if (startDate || endDate) {
      where.timestamp = {}
      if (startDate) {
        where.timestamp.gte = new Date(startDate)
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate)
      }
    }

    // Fetch logs with pagination
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
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
      }),
      prisma.auditLog.count({ where }),
    ])

    // Parse JSON fields
    const logsWithParsedJson = logs.map(log => ({
      ...log,
      changes: log.changes ? JSON.parse(log.changes) : null,
      metadata: log.metadata ? JSON.parse(log.metadata) : null,
    }))

    logger.info('Audit logs fetched', { count: logs.length, total, page })
    logger.logApiResponse('GET', '/api/audit', 200, Date.now() - startTime)

    return NextResponse.json({
      logs: logsWithParsedJson,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    logger.error('Failed to fetch audit logs', error as Error)
    logger.logApiResponse('GET', '/api/audit', 500, Date.now() - startTime)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}
