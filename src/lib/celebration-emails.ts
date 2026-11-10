/**
 * Celebration emails: birthdays and work anniversaries. Both share the same
 * transporter, template and CelebrationEmailLog idempotency table (`kind`).
 *
 * Sent from the company's official "allkmit" mailbox, which is a DIFFERENT
 * account from SMTP_USER (leave emails). Configure with:
 *   CELEBRATION_SMTP_USER, CELEBRATION_SMTP_PASS            (required)
 *   CELEBRATION_SMTP_HOST  (default SMTP_HOST or smtp.gmail.com)
 *   CELEBRATION_SMTP_PORT  (default 465)
 *   CELEBRATION_FROM_NAME  (default "KeyMouse IT")
 * There is intentionally NO fallback to SMTP_USER: if unset, sending is skipped.
 */
import nodemailer from 'nodemailer'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { isOccurrenceToday, istDateKey, ordinal, workAnniversaryYearsToday } from '@/lib/employee-dates'
import { formatIst, formatIstDate } from '@/lib/ist'

export const COMPANY_NAME = 'KeyMouse IT'

export type CelebrationKind = 'birthday' | 'work_anniversary'

type CelebrationMailConfig = {
  host: string
  port: number
  user: string
  pass: string
  fromName: string
}

/** null when the dedicated celebration mailbox is not configured. */
export function getCelebrationMailConfig(): CelebrationMailConfig | null {
  const user = process.env.CELEBRATION_SMTP_USER?.trim()
  const pass = process.env.CELEBRATION_SMTP_PASS
  if (!user || !pass) return null
  const port = parseInt(process.env.CELEBRATION_SMTP_PORT || '465', 10) || 465
  return {
    host: process.env.CELEBRATION_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    user,
    pass,
    fromName: process.env.CELEBRATION_FROM_NAME?.trim() || COMPANY_NAME,
  }
}

let cachedTransporter: { key: string; transporter: nodemailer.Transporter } | null = null

function getTransporter(config: CelebrationMailConfig) {
  const key = `${config.host}:${config.port}:${config.user}`
  if (cachedTransporter?.key === key) return cachedTransporter.transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })
  cachedTransporter = { key, transporter }
  return transporter
}

// ─── Template ────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName.trim()
}

/** Same look as getEmailTemplate in notifications.ts, branded for company-wide celebrations. */
export function getCelebrationEmailTemplate(
  title: string,
  contentHtml: string,
  accentColor = '#db2777',
  emoji = '🎂',
  tintColor = '#fdf2f8',
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
    .header { background-color: ${accentColor}; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .content { padding: 40px 32px; color: #374151; font-size: 16px; line-height: 1.6; }
    .content p { margin-top: 0; margin-bottom: 16px; }
    .content strong { color: #111827; }
    .details-box { background-color: ${tintColor}; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid ${accentColor}; text-align: center; }
    .footer { text-align: center; padding-top: 32px; color: #9ca3af; font-size: 14px; }
    .logo-text { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 800; color: rgba(255,255,255,0.75); margin-bottom: 12px; display: block; }
    .emoji { font-size: 40px; line-height: 1; margin-bottom: 12px; display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <span class="logo-text">${escapeHtml(COMPANY_NAME)}</span>
        <span class="emoji">${emoji}</span>
        <h1>${title}</h1>
      </div>
      <div class="content">
        ${contentHtml}
        <br/>
        <p style="color: #6b7280; font-size: 15px;">Warm wishes,<br/><strong style="color: #374151;">Team ${escapeHtml(COMPANY_NAME)}</strong></p>
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} ${escapeHtml(COMPANY_NAME)}. All rights reserved.
    </div>
  </div>
</body>
</html>
  `
}

export type BirthdayPerson = { name: string; designation?: string | null }

/** Subject / HTML / plain text for one birthday person (pure; no I/O). */
export function buildBirthdayEmail(person: BirthdayPerson, today: Date = new Date()) {
  const name = person.name.trim()
  const first = firstName(name)
  const designation = person.designation?.trim() || ''
  const who = designation ? `${name} (${designation})` : name
  const dayLabel = formatIst(today, { weekday: 'long', day: 'numeric', month: 'long' })

  const subject = `🎉 Happy Birthday, ${first}!`

  const html = getCelebrationEmailTemplate(
    `Happy Birthday, ${escapeHtml(first)}!`,
    `
      <p>Hi everyone,</p>
      <p>Today is a special day! Join us in wishing <strong>${escapeHtml(who)}</strong> a very happy birthday! 🎉</p>
      <div class="details-box">
        <p style="margin: 0; font-size: 18px; color: #111827;"><strong>Happy Birthday, ${escapeHtml(first)}! 🎈</strong></p>
        <p style="margin: 8px 0 0; color: #4b5563;">
          Thank you for everything you bring to ${escapeHtml(COMPANY_NAME)}. We hope your year ahead is full of
          happiness, good health, and success, and that today is as wonderful as you are.
        </p>
      </div>
      <p>Take a moment today to drop ${escapeHtml(first)} a message and make the day memorable. 🥳</p>
      <p style="color: #9ca3af; font-size: 13px;">${escapeHtml(dayLabel)}</p>
    `,
  )

  const text = [
    `Hi everyone,`,
    ``,
    `Today is a special day! Join us in wishing ${who} a very happy birthday!`,
    ``,
    `Happy Birthday, ${first}! Thank you for everything you bring to ${COMPANY_NAME}. We hope your year ahead is full of happiness, good health, and success, and that today is as wonderful as you are.`,
    ``,
    `Take a moment today to drop ${first} a message and make the day memorable.`,
    ``,
    `Warm wishes,`,
    `Team ${COMPANY_NAME}`,
  ].join('\n')

  return { subject, html, text }
}

export type AnniversaryPerson = {
  name: string
  designation?: string | null
  joiningDate: Date | string
  years: number
}

/** Subject / HTML / plain text for one work anniversary (pure; no I/O). */
export function buildWorkAnniversaryEmail(person: AnniversaryPerson) {
  const name = person.name.trim()
  const first = firstName(name)
  const designation = person.designation?.trim() || ''
  const who = designation ? `${name} (${designation})` : name
  const years = person.years
  const nth = ordinal(years)
  const yearsLabel = `${years} ${years === 1 ? 'year' : 'years'}`
  const joined = formatIstDate(person.joiningDate)

  const subject = `🎊 Happy ${nth} Work Anniversary, ${first}!`

  const html = getCelebrationEmailTemplate(
    `Happy ${nth} Work Anniversary, ${escapeHtml(first)}!`,
    `
      <p>Hi everyone,</p>
      <p>Today <strong>${escapeHtml(who)}</strong> completes <strong>${yearsLabel} with ${escapeHtml(COMPANY_NAME)}</strong>! 🎊</p>
      <div class="details-box">
        <p style="margin: 0; font-size: 18px; color: #111827;"><strong>Happy ${nth} Work Anniversary, ${escapeHtml(first)}! 🏆</strong></p>
        <p style="margin: 8px 0 0; color: #4b5563;">
          Thank you for your hard work, dedication, and everything you have contributed to ${escapeHtml(COMPANY_NAME)}
          over the past ${yearsLabel}. We are proud to have you on the team and look forward to many more
          milestones together.
        </p>
        <p style="margin: 12px 0 0; color: #6b7280; font-size: 14px;">With us since ${escapeHtml(joined)}</p>
      </div>
      <p>Join us in congratulating ${escapeHtml(first)} on this milestone! 👏</p>
    `,
    '#7c3aed',
    '🎊',
    '#f5f3ff',
  )

  const text = [
    `Hi everyone,`,
    ``,
    `Today ${who} completes ${yearsLabel} with ${COMPANY_NAME}!`,
    ``,
    `Happy ${nth} Work Anniversary, ${first}! Thank you for your hard work, dedication, and everything you have contributed to ${COMPANY_NAME} over the past ${yearsLabel}. We are proud to have you on the team and look forward to many more milestones together.`,
    ``,
    `With us since ${joined}.`,
    ``,
    `Join us in congratulating ${first} on this milestone!`,
    ``,
    `Warm wishes,`,
    `Team ${COMPANY_NAME}`,
  ].join('\n')

  return { subject, html, text }
}

// ─── Daily runner ────────────────────────────────────────────────────────────

export const CELEBRATION_KINDS: CelebrationKind[] = ['birthday', 'work_anniversary']

export function isCelebrationKind(value: string): value is CelebrationKind {
  return (CELEBRATION_KINDS as string[]).includes(value)
}

export type CelebrationKindResult = {
  ok: boolean
  people: {
    memberId: string
    name: string
    designation: string | null
    /** work_anniversary only */
    years?: number
    alreadySent: boolean
  }[]
  sent: { memberId: string; name: string; recipientCount: number }[]
  skipped: { memberId: string; name: string; reason: string }[]
  errors: { memberId: string; name: string; error: string }[]
  skippedReason?: string
}

export type CelebrationRunResult = {
  ok: boolean
  dryRun: boolean
  dateKey: string
  smtpConfigured: boolean
  recipientCount: number
  birthday?: CelebrationKindResult
  work_anniversary?: CelebrationKindResult
}

/** Unique, trimmed official emails of the given members (case-insensitive). */
export function uniqueEmails(members: { email: string | null }[]): string[] {
  const seen = new Map<string, string>()
  for (const m of members) {
    const email = m.email?.trim()
    if (!email || !email.includes('@')) continue
    const key = email.toLowerCase()
    if (!seen.has(key)) seen.set(key, email)
  }
  return Array.from(seen.values())
}

type Celebrant = {
  id: string
  name: string
  designation: string | null
  years?: number
  email: { subject: string; html: string; text: string }
}

/**
 * Daily celebration emails. For each kind, finds active members celebrating
 * today (IST month/day, Feb 29 → Feb 28 in non-leap years):
 *   - birthday:          birthday matches
 *   - work_anniversary:  joiningDate matches and ≥ 1 year completed
 *                        (no createdAt fallback; null joiningDate is skipped)
 * and emails each greeting to every active member (BCC; To = the celebration
 * mailbox). Idempotent per (kind, member, IST day) via CelebrationEmailLog;
 * the log row is written only after a successful send.
 *
 * dryRun: reads only; sends nothing and writes nothing.
 */
export async function runCelebrationEmails(
  opts: { today?: Date; dryRun?: boolean; kinds?: CelebrationKind[] } = {},
): Promise<CelebrationRunResult> {
  const today = opts.today ?? new Date()
  const dryRun = opts.dryRun === true
  const kinds = opts.kinds?.length ? opts.kinds : CELEBRATION_KINDS
  const dateKey = istDateKey(today)
  const config = getCelebrationMailConfig()

  const activeMembers = await prisma.teamMember.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, designation: true, birthday: true, joiningDate: true },
    orderBy: { name: 'asc' },
  })
  const recipients = uniqueEmails(activeMembers)

  const celebrantsByKind: Partial<Record<CelebrationKind, Celebrant[]>> = {}
  if (kinds.includes('birthday')) {
    celebrantsByKind.birthday = activeMembers
      .filter(m => m.birthday && isOccurrenceToday(m.birthday, today))
      .map(m => ({
        id: m.id,
        name: m.name,
        designation: m.designation ?? null,
        email: buildBirthdayEmail(m, today),
      }))
  }
  if (kinds.includes('work_anniversary')) {
    const list: Celebrant[] = []
    for (const m of activeMembers) {
      const years = workAnniversaryYearsToday(m.joiningDate, today)
      if (years === null || !m.joiningDate) continue
      list.push({
        id: m.id,
        name: m.name,
        designation: m.designation ?? null,
        years,
        email: buildWorkAnniversaryEmail({ ...m, joiningDate: m.joiningDate, years }),
      })
    }
    celebrantsByKind.work_anniversary = list
  }

  const result: CelebrationRunResult = {
    ok: true,
    dryRun,
    dateKey,
    smtpConfigured: !!config,
    recipientCount: recipients.length,
  }

  const transporter = config ? getTransporter(config) : null
  const from = config ? `"${config.fromName.replace(/"/g, '')}" <${config.user}>` : ''

  for (const kind of kinds) {
    const celebrants = celebrantsByKind[kind] ?? []
    const existingLogs = celebrants.length
      ? await prisma.celebrationEmailLog.findMany({
          where: { kind, dateKey, memberId: { in: celebrants.map(c => c.id) } },
          select: { memberId: true },
        })
      : []
    const alreadySent = new Set(existingLogs.map(l => l.memberId))

    const kindResult: CelebrationKindResult = {
      ok: true,
      people: celebrants.map(c => ({
        memberId: c.id,
        name: c.name,
        designation: c.designation,
        ...(c.years !== undefined ? { years: c.years } : {}),
        alreadySent: alreadySent.has(c.id),
      })),
      sent: [],
      skipped: [],
      errors: [],
    }
    result[kind] = kindResult

    if (dryRun || celebrants.length === 0) continue

    if (!config || !transporter) {
      logger.warn('Celebration emails skipped: CELEBRATION_SMTP_USER / CELEBRATION_SMTP_PASS not set', {
        kind,
        dateKey,
        people: celebrants.length,
      })
      kindResult.ok = false
      kindResult.skippedReason = 'celebration_smtp_not_configured'
      continue
    }
    if (recipients.length === 0) {
      kindResult.ok = false
      kindResult.skippedReason = 'no_recipients'
      continue
    }

    for (const person of celebrants) {
      if (alreadySent.has(person.id)) {
        kindResult.skipped.push({ memberId: person.id, name: person.name, reason: 'already_sent' })
        continue
      }
      try {
        const { subject, html, text } = person.email
        await transporter.sendMail({ from, to: config.user, bcc: recipients, subject, html, text })
        try {
          await prisma.celebrationEmailLog.create({
            data: { kind, memberId: person.id, dateKey, recipientCount: recipients.length },
          })
        } catch (err) {
          // A concurrent run already logged it: the email still went out, nothing to undo.
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
        }
        kindResult.sent.push({ memberId: person.id, name: person.name, recipientCount: recipients.length })
        logger.info('Celebration email sent', { kind, memberId: person.id, dateKey, recipients: recipients.length })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error('Celebration email failed', err instanceof Error ? err : undefined, {
          kind,
          memberId: person.id,
          dateKey,
        })
        kindResult.errors.push({ memberId: person.id, name: person.name, error: message })
      }
    }
    if (kindResult.errors.length > 0) kindResult.ok = false
  }

  result.ok = kinds.every(k => result[k]?.ok !== false)
  return result
}
