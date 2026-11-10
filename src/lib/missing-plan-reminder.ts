import { prisma } from '@/lib/prisma'
import { businessDayKey, businessDayStart, requiresDailyCadence } from '@/lib/daily'
import { getExpectedHoursBatch, type ExpectedHoursBatch } from '@/lib/expected-hours'
import { checkReminderHoliday } from '@/lib/holidays'
import { isIstWeekend } from '@/lib/ist'
import { logger } from '@/lib/logger'
import {
  getSlackBotToken,
  lookupSlackUserIdByEmail,
  parseSlackUserIdOverrides,
  postSlackMessage,
  postSlackWebhook,
} from '@/lib/slack/web-api'

type MemberLike = { id: string; role: string }

/**
 * Single source of truth for the Daily ops "NO MORNING PLAN" / "ON LEAVE" split
 * (used by /daily team view AND the 15:00 IST Slack reminder so counts match).
 *
 * - Founders never need a plan (requiresDailyCadence).
 * - "Has a plan" = a DailyLog row exists for the IST business day.
 * - Approved full-day leave (expected hours 0) moves the member to onLeave.
 *   Half-day / short leave / WFH still expect a plan → stay in noPlan.
 */
export function splitNoMorningPlan<M extends MemberLike>(
  members: M[],
  memberIdsWithLog: Set<string>,
  expectedBatch: ExpectedHoursBatch | null,
  dateKey: string,
): { cadenceMembers: M[]; noPlan: M[]; onLeaveNoPlan: M[]; isOnFullDayLeave: (memberId: string) => boolean } {
  const cadenceMembers = members.filter(m => requiresDailyCadence(m.role))
  const isOnFullDayLeave = (memberId: string) => {
    const day = expectedBatch?.get(memberId)?.get(dateKey)
    return Boolean(day && day.expectedHours <= 0)
  }
  const withoutLog = cadenceMembers.filter(m => !memberIdsWithLog.has(m.id))
  return {
    cadenceMembers,
    noPlan: withoutLog.filter(m => !isOnFullDayLeave(m.id)),
    onLeaveNoPlan: withoutLog.filter(m => isOnFullDayLeave(m.id)),
    isOnFullDayLeave,
  }
}

export type MissingPlanMember = {
  id: string
  name: string
  email: string
  role: string
  leaveHint: string | null
}

/** Read-only: who has no morning plan for the IST day (Daily ops logic + attendanceExcluded removed). */
export async function getMissingMorningPlanMembers(date: Date | string = new Date()) {
  const dayStart = businessDayStart(date)
  const dateKey = businessDayKey(dayStart)

  const [members, logs] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, attendanceExcluded: true },
    }),
    prisma.dailyLog.findMany({ where: { date: dayStart }, select: { memberId: true } }),
  ])

  const cadenceIds = members.filter(m => requiresDailyCadence(m.role)).map(m => m.id)
  const batch = await getExpectedHoursBatch(cadenceIds, dayStart, dayStart)
  const { noPlan, onLeaveNoPlan } = splitNoMorningPlan(
    members,
    new Set(logs.map(l => l.memberId)),
    batch,
    dateKey,
  )

  const toOut = (m: (typeof members)[number]): MissingPlanMember => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    leaveHint: batch.get(m.id)?.get(dateKey)?.leaveHint ?? null,
  })

  return {
    dateKey,
    /** Exactly what Daily ops shows under "NO MORNING PLAN". */
    dailyOpsNoPlan: noPlan.map(toOut),
    /** Reminder targets: dailyOpsNoPlan minus attendanceExcluded members. */
    missing: noPlan.filter(m => !m.attendanceExcluded).map(toOut),
    excludedAttendance: noPlan.filter(m => m.attendanceExcluded).map(toOut),
    onFullDayLeave: onLeaveNoPlan.map(toOut),
  }
}

export function appBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    'https://agency.keymouseit.com'
  return raw.replace(/\/$/, '')
}

export function buildMissingPlanMessage(mentions: string[], link = `${appBaseUrl()}/daily`): string {
  return `Hi ${mentions.join(' ')} — your today's tasks are missing. Kindly add your tasks on <${link}|Agency Ops (AO's)>.`
}

export type MissingPlanReminderResult = {
  ok: boolean
  dateKey: string
  dryRun: boolean
  skipped?: 'weekend' | 'holiday' | 'holiday_check_failed' | 'nobody_missing' | 'no_slack_config'
  /** Name of the national/public holiday that caused the skip (also set for a floating holiday, which does NOT skip). */
  holidayName?: string | null
  holidayType?: string | null
  /** Present when skipped === 'holiday_check_failed' (Holiday table unreadable → fail-safe, nothing posted). */
  holidayError?: string
  missing: Array<{ name: string; email: string; mention: string; slackUserId: string | null; lookupError?: string; leaveHint: string | null }>
  dailyOpsNoPlan: string[]
  excludedAttendance: string[]
  onFullDayLeave: string[]
  message: string | null
  posted: boolean
  via?: 'bot' | 'webhook'
  slackError?: string
}

/**
 * Weekday 15:00 IST reminder in Slack #general for members with no morning plan.
 * dryRun: compute + build message, never post (Slack lookups are read-only and still run if a token exists).
 */
export async function runMissingPlanReminder(opts: { dryRun?: boolean; now?: Date } = {}): Promise<MissingPlanReminderResult> {
  const now = opts.now ?? new Date()
  const dryRun = Boolean(opts.dryRun)
  const dateKey = businessDayKey(now)
  const weekend = isIstWeekend(now)

  const emptyResult = (extra: Partial<MissingPlanReminderResult>): MissingPlanReminderResult => ({
    ok: true,
    dateKey,
    dryRun,
    missing: [],
    dailyOpsNoPlan: [],
    excludedAttendance: [],
    onFullDayLeave: [],
    message: null,
    posted: false,
    ...extra,
  })

  // Weekends / company holidays: exit before any DB list or Slack lookup.
  if (weekend) return emptyResult({ skipped: 'weekend' })
  const holidayCheck = await checkReminderHoliday(dateKey, 'missing-plan-reminder')
  if (holidayCheck.skip) {
    return holidayCheck.reason === 'holiday'
      ? emptyResult({ skipped: 'holiday', holidayName: holidayCheck.holiday.name, holidayType: holidayCheck.holiday.type })
      : emptyResult({ skipped: 'holiday_check_failed', holidayError: holidayCheck.error })
  }
  // Floating holiday (optional): reminder still runs; people on approved leave are excluded below.
  const holidayName = holidayCheck.holiday?.name ?? null
  const holidayType = holidayCheck.holiday?.type ?? null

  const data = await getMissingMorningPlanMembers(now)
  const names = (list: MissingPlanMember[]) => list.map(m => m.name)

  const base = {
    dateKey,
    dryRun,
    holidayName,
    holidayType,
    dailyOpsNoPlan: names(data.dailyOpsNoPlan),
    excludedAttendance: names(data.excludedAttendance),
    onFullDayLeave: names(data.onFullDayLeave),
  }

  const token = getSlackBotToken()
  const overrides = parseSlackUserIdOverrides()
  const missing: MissingPlanReminderResult['missing'] = []
  for (const m of data.missing) {
    let slackUserId = overrides.get(m.email.toLowerCase()) ?? null
    let lookupError: string | undefined
    if (!slackUserId && token) {
      const r = await lookupSlackUserIdByEmail(token, m.email)
      slackUserId = r.id
      lookupError = r.error
    }
    missing.push({
      name: m.name,
      email: m.email,
      slackUserId,
      lookupError,
      mention: slackUserId ? `<@${slackUserId}>` : `@${m.name}`,
      leaveHint: m.leaveHint,
    })
  }

  const message = missing.length ? buildMissingPlanMessage(missing.map(m => m.mention)) : null
  const result: MissingPlanReminderResult = { ok: true, ...base, missing, message, posted: false }

  if (!message) return { ...result, skipped: 'nobody_missing' }
  if (dryRun) return result

  const channel = process.env.SLACK_REMINDER_CHANNEL_ID?.trim()
  const webhook = process.env.SLACK_REMINDER_WEBHOOK_URL?.trim()
  if (token && channel) {
    const r = await postSlackMessage(token, channel, message)
    logger.info('missing-plan-reminder posted (bot)', { dateKey, count: missing.length, ok: r.ok, error: r.error })
    return { ...result, ok: r.ok, posted: r.ok, via: 'bot', slackError: r.error }
  }
  if (webhook) {
    const r = await postSlackWebhook(webhook, message)
    logger.info('missing-plan-reminder posted (webhook)', { dateKey, count: missing.length, ok: r.ok, error: r.error })
    return { ...result, ok: r.ok, posted: r.ok, via: 'webhook', slackError: r.error }
  }
  logger.warn('missing-plan-reminder: no SLACK_BOT_TOKEN+SLACK_REMINDER_CHANNEL_ID or SLACK_REMINDER_WEBHOOK_URL — skipped', { dateKey })
  return { ...result, skipped: 'no_slack_config' }
}
