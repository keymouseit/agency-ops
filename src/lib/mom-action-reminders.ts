import { differenceInCalendarDays, startOfDay } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { logger } from '@/lib/logger'

const OPENISH = ['Open', 'InProgress', 'Blocked'] as const

function hoursSince(date: Date | null | undefined, now: Date) {
  if (!date) return Infinity
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60)
}

/**
 * Daily-ish MOM action reminders:
 * - due today → notify owner (mom_action_due)
 * - 1+ day overdue → notify owner (mom_action_overdue)
 * - 3+ days overdue → notify owner + Founder/Manager (mom_action_escalation)
 *
 * Idempotent via lastOwnerNudgeAt / lastEscalationAt (≈ once per 20h).
 */
export async function runMomActionReminders(now = new Date()) {
  const today = startOfDay(now)
  const actions = await prisma.momActionItem.findMany({
    where: { status: { in: [...OPENISH] } },
    include: {
      owner: { select: { id: true, name: true } },
      mom: {
        select: {
          id: true,
          parentId: true,
          clientName: true,
          companyName: true,
        },
      },
    },
  })

  let dueToday = 0
  let overdue = 0
  let escalations = 0

  const founders = await prisma.teamMember.findMany({
    where: { active: true, role: { in: ['Founder', 'Manager'] } },
    select: { id: true },
  })
  const founderIds = founders.map(f => f.id)

  for (const action of actions) {
    const due = startOfDay(action.dueDate)
    const daysUntil = differenceInCalendarDays(due, today)
    const overdueDays = differenceInCalendarDays(today, due)
    const clientLabel = action.mom.companyName
      ? `${action.mom.clientName} · ${action.mom.companyName}`
      : action.mom.clientName
    const rootId = action.mom.parentId ?? action.mom.id
    const link = `/mom/${rootId}`

    try {
      if (daysUntil === 0 && hoursSince(action.lastOwnerNudgeAt, now) >= 20) {
        await notify(
          'mom_action_due',
          [action.ownerId],
          `MOM action due today: “${action.title}” for ${clientLabel}`,
          link
        )
        await prisma.momActionItem.update({
          where: { id: action.id },
          data: { lastOwnerNudgeAt: now },
        })
        dueToday += 1
        continue
      }

      if (overdueDays >= 1 && hoursSince(action.lastOwnerNudgeAt, now) >= 20) {
        await notify(
          'mom_action_overdue',
          [action.ownerId],
          `MOM action overdue (${overdueDays}d): “${action.title}” for ${clientLabel}`,
          link
        )
        await prisma.momActionItem.update({
          where: { id: action.id },
          data: { lastOwnerNudgeAt: now },
        })
        overdue += 1
      }

      if (overdueDays >= 3 && hoursSince(action.lastEscalationAt, now) >= 20) {
        const recipients = [...new Set([action.ownerId, ...founderIds])]
        await notify(
          'mom_action_escalation',
          recipients,
          `Escalation: MOM action ${overdueDays}d overdue — “${action.title}” (${clientLabel}) · owner ${action.owner.name}`,
          link
        )
        await prisma.momActionItem.update({
          where: { id: action.id },
          data: { lastEscalationAt: now },
        })
        escalations += 1
      }
    } catch (err) {
      logger.error('MOM action reminder failed', err as Error, { actionId: action.id })
    }
  }

  return {
    scanned: actions.length,
    dueToday,
    overdue,
    escalations,
  }
}
