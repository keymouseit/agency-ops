import { prisma } from '@/lib/prisma'
import { logger } from './logger'
import { sendPushNotification } from './push-notifications'

type NotificationType =
  | 'estimate_requested'
  | 'estimate_confirmed'
  | 'estimate_revision'
  | 'estimate_approved'
  | 'blocker_escalated'
  | 'project_assigned'
  | 'project_in_qa'
  | 'milestone_ready_for_qa'
  | 'milestone_testing_started'
  | 'milestone_test_case_failed'
  | 'milestone_qa_approved'
  | 'milestone_bug_logged'
  | 'scope_change_requested'
  | 'scope_change_approved'
  | 'scope_change_declined'
  | 'test_cycle_fail'
  | 'test_cycle_pass'
  | 'test_cycle_fix_ready'
  | 'eod_missing'
  | 'mom_attendee'
  | 'mom_action_due'
  | 'mom_action_overdue'
  | 'mom_action_escalation'
  | 'mom_action_blocked'
  | 'mom_action_assigned'
  | 'mom_action_done'
  | 'mom_action_status'
  | 'mom_action_status_alert'
  | 'mom_followup_completed'
  | 'leave_applied'
  | 'leave_approved'
  | 'leave_rejected'

/**
 * Notify developer and/or BD when assigned to a project (skips the creator).
 */
export async function notifyProjectAssigned(
  assigneeIds: (string | null | undefined)[],
  creatorId: string | undefined,
  projectName: string,
  projectLink: string
): Promise<void> {
  const uniqueIds = [...new Set(
    assigneeIds.filter((id): id is string => !!id && id !== creatorId)
  )]
  if (!uniqueIds.length) return

  const creator = creatorId
    ? await prisma.teamMember.findUnique({ where: { id: creatorId }, select: { name: true } })
    : null
  const creatorName = creator?.name ?? 'Someone'

  await notify(
    'project_assigned',
    uniqueIds,
    `${creatorName} assigned you to project: ${projectName}`,
    projectLink
  )
}

/**
 * Fire a notification to one or more members.
 *
 * Usage in any API route:
 *   await notify('estimate_requested', [devId], 'Kavya requested an estimate for HealthCo', '/estimate/abc')
 *
 * Never throws — notification failure should never break the main action.
 */
export async function notify(
  type: NotificationType,
  memberIds: string[],
  message: string,
  linkTo?: string
): Promise<void> {
  if (!memberIds.length) {
    logger.warn('notify called with empty memberIds array', { type, message })
    return
  }

  logger.debug('Creating notifications', { type, memberIds, message: message.substring(0, 100), linkTo })

  try {
    await prisma.notification.createMany({
      data: memberIds.map(memberId => ({
        memberId,
        type,
        message,
        linkTo: linkTo ?? null,
      })),
    })
    logger.info('Notifications created successfully', { type, count: memberIds.length, memberIds })

    // Never send push notifications for leave events from generic notify(),
    // as all leave events are handled exclusively and cleanly via notifyFounderLeaveEvent
    if (!type.startsWith('leave_')) {
      sendPushNotification({
        memberIds,
        title: type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        body: message,
        data: { type, linkTo: linkTo ?? '/leaves' },
      }).catch(e => logger.error('Push notification background error', e))
    }
  } catch (err) {
    // Log but never propagate — notifications are best-effort
    logger.error('Failed to create notifications', err as Error, { type, memberIds, message })
    console.error('[notify] Failed to create notification:', err)
  }
}

/**
 * Mark a single notification as read.
 */
export async function markRead(notificationId: string): Promise<void> {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    })
  } catch {}
}

/**
 * Mark all of a member's notifications as read.
 */
export async function markAllRead(memberId: string): Promise<void> {
  try {
    await prisma.notification.updateMany({
      where: { memberId, read: false },
      data: { read: true },
    })
  } catch {}
}

/**
 * Get unread notification count for a member (used for nav badge).
 */
export async function unreadCount(memberId: string): Promise<number> {
  try {
    return await prisma.notification.count({
      where: { memberId, read: false },
    })
  } catch {
    return 0
  }
}
