import { logAudit, getClientIP } from '@/lib/audit'
import type { AuditAction } from '@/lib/audit'
import type { QAEventType } from '@/lib/qa-audit-format'

export type { QAEventType } from '@/lib/qa-audit-format'
export { formatQAActivitySummary } from '@/lib/qa-audit-format'

export async function logProjectQAActivity(
  action: AuditAction,
  projectId: string,
  projectName: string,
  metadata: Record<string, unknown> & { qaEventType: QAEventType },
  request?: Request,
) {
  await logAudit({
    action,
    entityType: 'Project',
    entityId: projectId,
    entityName: projectName,
    metadata,
    ipAddress: request ? getClientIP(request) : undefined,
    userAgent: request ? request.headers.get('user-agent') || undefined : undefined,
  })
}
