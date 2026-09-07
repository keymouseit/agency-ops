import { prisma } from './prisma'
import { auth } from './auth'
import { logger } from './logger'

export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'activated'
  | 'deactivated'
  | 'signed_off'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'password_changed'

export type AuditEntity =
  | 'TeamMember'
  | 'Project'
  | 'Lead'
  | 'Estimate'
  | 'TestCycle'
  | 'ReleaseSignOff'
  | 'Goal'
  | 'Settings'
  | 'ScopeChange'
  | 'CheckIn'
  | 'PostDeliveryIssue'
  | 'LeaveBalance'
  | 'LeaveRequest'

export interface AuditLogParams {
  action: AuditAction
  entityType: AuditEntity
  entityId: string
  entityName?: string
  changes?: Record<string, { old: any; new: any }>
  metadata?: Record<string, any>
  userId?: string // Optional, will use session if not provided
  ipAddress?: string
  userAgent?: string
}

/**
 * Log an audit trail entry
 *
 * @param params - Audit log parameters
 * @returns Promise<void> - Never throws, logs errors internally
 *
 * @example
 * await logAudit({
 *   action: 'updated',
 *   entityType: 'TeamMember',
 *   entityId: member.id,
 *   entityName: member.name,
 *   changes: { role: { old: 'Dev', new: 'QA' } },
 *   ipAddress: getClientIP(req),
 *   userAgent: req.headers.get('user-agent')
 * })
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    logger.debug('Creating audit log entry', {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    })

    // Get user from session if not provided
    let userId = params.userId
    let userEmail: string | undefined
    let userName: string | undefined

    if (!userId) {
      const session = await auth()
      if (session?.user?.id) {
        userId = session.user.id
        userEmail = session.user.email || undefined
        userName = session.user.name || undefined
      }
    } else {
      // Fetch user details if userId provided
      const user = await prisma.teamMember.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      })
      userEmail = user?.email
      userName = user?.name
    }

    // Create the audit log entry
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        userEmail: userEmail || null,
        userName: userName || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName || null,
        changes: params.changes ? JSON.stringify(params.changes) : null,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        timestamp: new Date(),
      },
    })

    logger.info('Audit log created', {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: userId || 'system',
    })
  } catch (error) {
    // Don't throw - audit logging should never break the app
    logger.error('Failed to create audit log', error as Error, {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    })
    console.error('[audit] Failed to log audit:', error)
  }
}

/**
 * Capture field changes between old and new data
 *
 * @param oldData - Original data object
 * @param newData - New data object (partial)
 * @returns Object with field-level changes
 *
 * @example
 * const changes = captureChanges(
 *   { name: 'John', role: 'Dev', active: true },
 *   { role: 'QA', active: false }
 * )
 * // Returns: { role: { old: 'Dev', new: 'QA' }, active: { old: true, new: false } }
 */
export function captureChanges<T extends Record<string, any>>(
  oldData: T,
  newData: Partial<T>
): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {}

  for (const key in newData) {
    // Skip undefined values
    if (newData[key] === undefined) continue

    // Only record if value actually changed
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key],
      }
    }
  }

  return changes
}

/**
 * Get client IP address from request headers
 *
 * @param request - The incoming Request object
 * @returns IP address string or undefined
 *
 * @example
 * const ip = getClientIP(req)
 * // Returns: "192.168.1.100" or undefined
 */
export function getClientIP(request: Request): string | undefined {
  // Check X-Forwarded-For header (proxy/load balancer)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim()
  }

  // Check X-Real-IP header
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) {
    return cfIp
  }

  return undefined
}

/**
 * Helper to log team member changes
 */
export async function logTeamMemberChange(
  action: AuditAction,
  memberId: string,
  memberName: string,
  changes?: Record<string, { old: any; new: any }>,
  request?: Request
) {
  await logAudit({
    action,
    entityType: 'TeamMember',
    entityId: memberId,
    entityName: memberName,
    changes,
    ipAddress: request ? getClientIP(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
  })
}

/**
 * Helper to log project changes
 */
export async function logProjectChange(
  action: AuditAction,
  projectId: string,
  projectName: string,
  changes?: Record<string, { old: any; new: any }>,
  metadata?: Record<string, any>,
  request?: Request
) {
  await logAudit({
    action,
    entityType: 'Project',
    entityId: projectId,
    entityName: projectName,
    changes,
    metadata,
    ipAddress: request ? getClientIP(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
  })
}
