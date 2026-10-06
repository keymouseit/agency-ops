import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import type { ParsedMomActionInput } from '@/lib/mom-actions'
import { momActionStatusLabel } from '@/lib/utils'

function clientLabel(clientName: string, companyName?: string | null) {
  return companyName ? `${clientName} · ${companyName}` : clientName
}

/** Active Founder + Manager ids. */
export async function getActiveLeadMemberIds(): Promise<string[]> {
  const leads = await prisma.teamMember.findMany({
    where: { active: true, role: { in: ['Founder', 'Manager'] } },
    select: { id: true },
  })
  return leads.map(l => l.id)
}

function uniqueExclude(ids: (string | null | undefined)[], excludeId?: string | null) {
  return [...new Set(ids.filter((id): id is string => !!id && id !== excludeId))]
}

/**
 * Action marked Blocked → all active Founder + Manager + MOM createdBy
 * (excluding the actor who blocked).
 */
export async function notifyMomActionBlocked(opts: {
  actorId: string
  actorName: string
  createdById: string
  actionTitle: string
  clientName: string
  companyName?: string | null
  blockedReason: string
  momLinkId: string
}): Promise<void> {
  const leadIds = await getActiveLeadMemberIds()
  const recipients = uniqueExclude(
    [...leadIds, opts.createdById],
    opts.actorId
  )
  if (!recipients.length) return

  const label = clientLabel(opts.clientName, opts.companyName)
  await notify(
    'mom_action_blocked',
    recipients,
    `${opts.actorName} marked action Blocked: “${opts.actionTitle}” — ${label} · Reason: ${opts.blockedReason}`,
    `/mom/${opts.momLinkId}`
  )
}

/** New action owner(s) assigned (create or owner change). */
export async function notifyMomActionAssigned(opts: {
  actorId: string
  ownerIds: string[]
  clientName: string
  companyName?: string | null
  momLinkId: string
  detail?: string
}): Promise<void> {
  const recipients = uniqueExclude(opts.ownerIds, opts.actorId)
  if (!recipients.length) return

  const label = clientLabel(opts.clientName, opts.companyName)
  const detail = opts.detail ? ` — ${opts.detail}` : ''
  await notify(
    'mom_action_assigned',
    recipients,
    `You were assigned a MOM action for ${label}${detail}`,
    `/mom/${opts.momLinkId}`
  )
}

/** Action status → Done → notify MOM creator (if ≠ actor). */
export async function notifyMomActionDone(opts: {
  actorId: string
  actorName: string
  createdById: string
  actionTitle: string
  clientName: string
  companyName?: string | null
  momLinkId: string
}): Promise<void> {
  if (!opts.createdById || opts.createdById === opts.actorId) return

  const label = clientLabel(opts.clientName, opts.companyName)
  await notify(
    'mom_action_done',
    [opts.createdById],
    `${opts.actorName} marked action Done: “${opts.actionTitle}” — ${label}`,
    `/mom/${opts.momLinkId}`
  )
}


/**
 * Any action status change → all active Founder + Manager (excluding actor).
 * One notification per change (covers InProgress, Open, Done, NotCompleted, Skipped, Blocked, etc.).
 */
export async function notifyMomActionStatusChanged(opts: {
  actorId: string
  actorName: string
  actionTitle: string
  oldStatus: string
  newStatus: string
  clientName: string
  companyName?: string | null
  momLinkId: string
}): Promise<void> {
  const leadIds = await getActiveLeadMemberIds()
  const recipients = uniqueExclude(leadIds, opts.actorId)
  if (!recipients.length) return

  const label = clientLabel(opts.clientName, opts.companyName)
  const newLabel = momActionStatusLabel(opts.newStatus)
  // NotCompleted (UI "No") / Skipped → red danger toast; others stay neutral MOM status
  const type =
    opts.newStatus === 'NotCompleted' || opts.newStatus === 'Skipped'
      ? 'mom_action_status_alert'
      : 'mom_action_status'
  await notify(
    type,
    recipients,
    `${opts.actorName} set action “${opts.actionTitle}” to ${newLabel} — ${label}`,
    `/mom/${opts.momLinkId}`
  )
}

/**
 * Complete next call:
 * - createdBy if ≠ actor
 * - Founder/Manager when "no further call"
 * - thread action owners when "schedule next"
 */
export async function notifyMomFollowupCompleted(opts: {
  actorId: string
  actorName: string
  createdById: string
  clientName: string
  companyName?: string | null
  momLinkId: string
  rootId: string
  nextAction: 'schedule_next' | 'no_further'
  outcome: string
  nextFollowUpDate?: Date | null
  finalStatus?: string | null
}): Promise<void> {
  const label = clientLabel(opts.clientName, opts.companyName)
  const recipients = new Set<string>()

  if (opts.createdById && opts.createdById !== opts.actorId) {
    recipients.add(opts.createdById)
  }

  if (opts.nextAction === 'no_further') {
    for (const id of await getActiveLeadMemberIds()) {
      if (id !== opts.actorId) recipients.add(id)
    }
  } else {
    const rootId = opts.rootId
    const threadIds = (
      await prisma.meetingMinute.findMany({
        where: { OR: [{ id: rootId }, { parentId: rootId }] },
        select: { id: true },
      })
    ).map(m => m.id)

    const owners = await prisma.momActionItem.findMany({
      where: { momId: { in: threadIds } },
      select: { ownerId: true },
      distinct: ['ownerId'],
    })
    for (const o of owners) {
      if (o.ownerId !== opts.actorId) recipients.add(o.ownerId)
    }
  }

  if (!recipients.size) return

  let summary: string
  if (opts.nextAction === 'no_further') {
    summary = `No further call · Deal ${opts.finalStatus ?? 'updated'}`
  } else {
    const nextDate = opts.nextFollowUpDate
      ? opts.nextFollowUpDate.toISOString().slice(0, 10)
      : 'TBD'
    summary = `Next call scheduled for ${nextDate}`
  }
  const outcomeSnippet =
    opts.outcome.length > 120 ? `${opts.outcome.slice(0, 117)}…` : opts.outcome

  await notify(
    'mom_followup_completed',
    [...recipients],
    `${opts.actorName} completed next call for ${label}: ${summary} — ${outcomeSnippet}`,
    `/mom/${opts.momLinkId}`
  )
}

/**
 * Diff previous actions vs new plan; return owner ids who should get
 * mom_action_assigned (new actions or owner changes), excluding actor.
 */
export function ownersNeedingAssignmentNotify(
  prevActions: { id: string; ownerId: string }[],
  nextActions: ParsedMomActionInput[],
  actorId: string
): string[] {
  const prevById = new Map(prevActions.map(a => [a.id, a]))
  const toNotify = new Set<string>()

  for (const a of nextActions) {
    if (!a.ownerId || a.ownerId === actorId) continue
    if (a.id && prevById.has(a.id)) {
      if (prevById.get(a.id)!.ownerId !== a.ownerId) {
        toNotify.add(a.ownerId)
      }
    } else {
      toNotify.add(a.ownerId)
    }
  }

  return [...toNotify]
}
