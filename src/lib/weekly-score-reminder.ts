import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notify'
import { getWeekStart } from '@/lib/utils'
import { formatIst, istDateInputValue } from '@/lib/ist'
import { logger } from '@/lib/logger'

/** Roles that can POST a weekly self-assessment (matches /api/scores checkRole). */
export const SELF_SCORE_ROLES = ['Dev', 'BD', 'QA', 'Both', 'Founder', 'SocialMedia'] as const

export type SelfScoreRole = (typeof SELF_SCORE_ROLES)[number]

export function isSelfScoreRole(role: string | null | undefined): role is SelfScoreRole {
  return !!role && (SELF_SCORE_ROLES as readonly string[]).includes(role)
}

/** True when the member already has a self WeeklyScore for the given Monday week bucket. */
export async function hasSubmittedWeeklyScore(userId: string, weekStart: Date): Promise<boolean> {
  const existing = await prisma.weeklyScore.findUnique({
    where: {
      memberId_weekOf_founderScore: {
        memberId: userId,
        weekOf: weekStart,
        founderScore: false,
      },
    },
    select: { id: true },
  })
  return !!existing
}

/** IST weekday short name: Mon … Sun. */
export function istWeekdayShort(date: Date | string = new Date()) {
  return formatIst(date, { weekday: 'short' }, 'en-US')
}

/**
 * Home banner due window (IST short weekday names).
 * Easy to retune — e.g. add 'Mon' or drop 'Tue'. Hidden on Sat/Sun/Mon by default.
 */
export const WEEKLY_SCORE_BANNER_DAYS = ['Tue', 'Wed', 'Thu', 'Fri'] as const

/** True when `now` falls on a day in WEEKLY_SCORE_BANNER_DAYS (IST). */
export function isWeeklyScoreDueWindow(now = new Date()) {
  const day = istWeekdayShort(now)
  return (WEEKLY_SCORE_BANNER_DAYS as readonly string[]).includes(day)
}

export type WeeklyScoreHomePrompt =
  | { kind: 'due'; weekKey: string; isFriday: boolean }
  | { kind: 'none' }

/**
 * Home-page weekly score prompt.
 * Never for Founder. Manager only if listed in SELF_SCORE_ROLES (currently not).
 * Due window: WEEKLY_SCORE_BANNER_DAYS (Tue–Fri IST), until a self WeeklyScore
 * exists for this week. No "missed last week" banner — /checkin only accepts
 * the current week.
 */
export async function getWeeklyScoreHomePrompt(
  userId: string,
  role: string | null | undefined,
  now = new Date(),
  opts?: { forcePreview?: boolean },
): Promise<WeeklyScoreHomePrompt> {
  if (!userId || !role || role === 'Founder') return { kind: 'none' }
  if (!isSelfScoreRole(role)) return { kind: 'none' }

  const weekStart = getWeekStart(now)
  const weekKey = istDateInputValue(weekStart)
  const isFriday = istWeekdayShort(now) === 'Fri'

  if (opts?.forcePreview) {
    return { kind: 'due', weekKey, isFriday: true }
  }

  if (!isWeeklyScoreDueWindow(now)) return { kind: 'none' }
  if (await hasSubmittedWeeklyScore(userId, weekStart)) return { kind: 'none' }

  return { kind: 'due', weekKey, isFriday }
}

/**
 * Friday reminder: bell (via notify → also push if credentials exist) for every
 * active member who hasn't submitted a self WeeklyScore for the current week.
 * Idempotent: skips anyone who already got a weekly_score_reminder this week.
 *
 * Links to /checkin — where self-assessment already lives (My Day → check-in).
 */
export async function runWeeklyScoreReminder(now = new Date()) {
  const thisWeek = getWeekStart(now)

  const members = await prisma.teamMember.findMany({
    where: { active: true, role: { in: [...SELF_SCORE_ROLES] } },
    select: { id: true, name: true },
  })
  if (!members.length) return { candidates: 0, notified: 0, skipped: 'no_members' as const }

  const submitted = await prisma.weeklyScore.findMany({
    where: { weekOf: thisWeek, founderScore: false, memberId: { in: members.map(m => m.id) } },
    select: { memberId: true },
  })
  const submittedIds = new Set(submitted.map(s => s.memberId))
  const missing = members.filter(m => !submittedIds.has(m.id))
  if (!missing.length) {
    return { candidates: members.length, notified: 0, skipped: 'all_submitted' as const }
  }

  const already = await prisma.notification.findMany({
    where: {
      memberId: { in: missing.map(m => m.id) },
      type: 'weekly_score_reminder',
      createdAt: { gte: thisWeek },
    },
    select: { memberId: true },
  })
  const alreadyIds = new Set(already.map(n => n.memberId))
  const recipients = missing.filter(m => !alreadyIds.has(m.id)).map(m => m.id)
  if (!recipients.length) {
    return {
      candidates: members.length,
      missing: missing.length,
      notified: 0,
      skipped: 'already_reminded' as const,
    }
  }

  try {
    await notify(
      'weekly_score_reminder',
      recipients,
      'Reminder — submit your weekly self-assessment before the week closes.',
      '/checkin',
    )
  } catch (err) {
    logger.error('Weekly score reminder failed', err as Error)
    return { candidates: members.length, notified: 0, skipped: 'error' as const }
  }

  return {
    candidates: members.length,
    missing: missing.length,
    notified: recipients.length,
    alreadyReminded: alreadyIds.size,
  }
}
