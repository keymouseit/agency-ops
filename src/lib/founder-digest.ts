import { subHours, subWeeks } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { getFounderAttention } from '@/lib/founder-attention'
import { getWeekStart } from '@/lib/utils'

/**
 * Founder / Manager morning digest (in-app bell only).
 *
 * Runs from the existing MOM reminder cron (08:30 IST, see vercel.json).
 * Writes one Notification row per lead — no email, Slack, or push — so it has
 * no external side effects locally or in production.
 * Idempotent: skips a lead who already got a digest in the last 20 hours.
 * Skips entirely when nothing needs attention (no "all clear" noise).
 * Leave / WFH counts are intentionally not included — leave approval is HR work.
 */
export async function runFounderDigest(now = new Date()) {
  const leads = await prisma.teamMember.findMany({
    where: { active: true, role: { in: ['Founder', 'Manager'] } },
    select: { id: true },
  })
  if (!leads.length) return { leads: 0, sent: 0, skipped: 'no_leads' as const }

  const { digest } = await getFounderAttention({ now })
  const parts: string[] = []
  if (digest.scopeChanges) {
    parts.push(`${digest.scopeChanges} scope change${digest.scopeChanges === 1 ? '' : 's'} to decide`)
  }
  if (digest.escalatedBlockers) {
    parts.push(
      `${digest.escalatedBlockers} blocker${digest.escalatedBlockers === 1 ? '' : 's'} escalated to you`
    )
  }
  if (digest.overdue) parts.push(`${digest.overdue} overdue`)
  if (digest.stuck) {
    parts.push(
      digest.blockedSinceYesterday
        ? `${digest.stuck} stuck (${digest.blockedSinceYesterday} newly blocked since yesterday)`
        : `${digest.stuck} stuck`
    )
  }
  if (digest.atRisk) parts.push(`${digest.atRisk} project${digest.atRisk === 1 ? '' : 's'} at risk`)

  // Cheap Monday add-on: how many self-assessments were missing last week.
  const istWeekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(now)
  if (istWeekday === 'Mon') {
    const lastWeek = subWeeks(getWeekStart(now), 1)
    const selfScoreRoles = ['Dev', 'BD', 'QA', 'Both', 'Founder', 'SocialMedia']
    const expected = await prisma.teamMember.count({
      where: { active: true, role: { in: selfScoreRoles } },
    })
    if (expected > 0) {
      const submitted = await prisma.weeklyScore.findMany({
        where: { weekOf: lastWeek, founderScore: false },
        select: { memberId: true },
        distinct: ['memberId'],
      })
      const missing = expected - submitted.length
      if (missing > 0) {
        parts.push(`${missing} didn't submit last week`)
      }
    }
  }

  if (!parts.length) return { leads: leads.length, sent: 0, skipped: 'all_clear' as const }

  const since = subHours(now, 20)
  const alreadySent = await prisma.notification.findMany({
    where: {
      memberId: { in: leads.map(l => l.id) },
      type: 'founder_digest',
      createdAt: { gte: since },
    },
    select: { memberId: true },
  })
  const skip = new Set(alreadySent.map(n => n.memberId))
  const recipients = leads.map(l => l.id).filter(id => !skip.has(id))
  if (!recipients.length) return { leads: leads.length, sent: 0, skipped: 'already_sent' as const }

  const message = `Good morning — ${parts.join(' · ')}. Open Needs you to clear them.`
  try {
    await prisma.notification.createMany({
      data: recipients.map(memberId => ({
        memberId,
        type: 'founder_digest',
        message,
        linkTo: '/',
      })),
    })
  } catch (err) {
    logger.error('Founder digest failed', err as Error)
    return { leads: leads.length, sent: 0, skipped: 'error' as const }
  }

  return { leads: leads.length, sent: recipients.length, digest }
}
