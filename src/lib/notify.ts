import { prisma } from '@/lib/prisma'

type NotificationType =
  | 'estimate_requested'
  | 'estimate_confirmed'
  | 'estimate_revision'
  | 'estimate_approved'
  | 'blocker_escalated'
  | 'project_assigned'
  | 'project_in_qa'
  | 'test_cycle_fail'
  | 'test_cycle_pass'
  | 'eod_missing'

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
  if (!memberIds.length) return
  try {
    await prisma.notification.createMany({
      data: memberIds.map(memberId => ({
        memberId,
        type,
        message,
        linkTo: linkTo ?? null,
      })),
    })
  } catch (err) {
    // Log but never propagate — notifications are best-effort
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
