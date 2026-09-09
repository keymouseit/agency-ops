import { prisma } from '@/lib/prisma'

export const NOTIFICATION_PURPOSES = ['leave_applied', 'leave_decision', 'leave_calendar'] as const
export type NotificationPurpose = (typeof NOTIFICATION_PURPOSES)[number]

export const NOTIFICATION_GROUPS: Record<
  NotificationPurpose,
  { label: string; description: string }
> = {
  leave_applied: {
    label: 'New leave applications',
    description: 'These people get an email when someone applies for leave.',
  },
  leave_decision: {
    label: 'Leave approved or rejected',
    description:
      'These people are copied when a leave is approved or rejected. The employee always gets the email too.',
  },
  leave_calendar: {
    label: 'Leave calendar',
    description:
      'Approved leaves are added to these Google Calendar emails. Cancelled leaves are removed from the same list.',
  },
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function isValidEmail(value: string) {
  return EMAIL_RE.test(normalizeEmail(value))
}

function parseEnvEmails(raw?: string) {
  if (!raw) return []
  return [...new Set(raw.split(/[,;]/).map(normalizeEmail).filter(isValidEmail))]
}

function defaultEmails(purpose: NotificationPurpose): string[] {
  if (purpose === 'leave_applied') {
    const fromEnv = parseEnvEmails(process.env.HR_EMAIL)
    return fromEnv.length ? fromEnv : ['leaves@keymouseit.com', 'shiven@keymouseit.com']
  }
  if (purpose === 'leave_decision') {
    return ['shiven@keymouseit.com']
  }
  const calendar = parseEnvEmails(process.env.GOOGLE_CALENDAR_ID)
  return calendar.length ? calendar : ['shiven.juneja@gmail.com']
}

export async function ensureNotificationEmailDefaults() {
  const existing = await prisma.notificationEmail.findMany({ select: { purpose: true } })
  const present = new Set(existing.map(row => row.purpose))
  const missing = NOTIFICATION_PURPOSES.filter(purpose => !present.has(purpose))
  if (!missing.length) return

  await prisma.notificationEmail.createMany({
    data: missing.flatMap(purpose =>
      defaultEmails(purpose).map(email => ({ purpose, email })),
    ),
    skipDuplicates: true,
  })
}

export async function getNotificationEmails(purpose: NotificationPurpose): Promise<string[]> {
  try {
    await ensureNotificationEmailDefaults()
    const rows = await prisma.notificationEmail.findMany({
      where: { purpose },
      orderBy: { email: 'asc' },
      select: { email: true },
    })
    if (rows.length) return rows.map(row => row.email)
  } catch (error) {
    console.error('Failed to read notification emails:', error)
  }
  return defaultEmails(purpose)
}

export async function listNotificationEmailGroups() {
  try {
    await ensureNotificationEmailDefaults()
    const rows = await prisma.notificationEmail.findMany({
      orderBy: [{ purpose: 'asc' }, { email: 'asc' }],
      select: { purpose: true, email: true },
    })
    const byPurpose = new Map<string, string[]>()
    for (const row of rows) {
      const list = byPurpose.get(row.purpose) ?? []
      list.push(row.email)
      byPurpose.set(row.purpose, list)
    }
    return NOTIFICATION_PURPOSES.map(purpose => ({
      purpose,
      ...NOTIFICATION_GROUPS[purpose],
      emails: byPurpose.get(purpose) ?? defaultEmails(purpose),
    }))
  } catch (error) {
    console.error('Failed to list notification emails:', error)
    return NOTIFICATION_PURPOSES.map(purpose => ({
      purpose,
      ...NOTIFICATION_GROUPS[purpose],
      emails: defaultEmails(purpose),
    }))
  }
}

export async function setNotificationEmails(purpose: NotificationPurpose, emails: string[]) {
  const unique = [...new Set(emails.map(normalizeEmail).filter(isValidEmail))]
  await prisma.$transaction([
    prisma.notificationEmail.deleteMany({ where: { purpose } }),
    ...(unique.length
      ? [
          prisma.notificationEmail.createMany({
            data: unique.map(email => ({ purpose, email })),
          }),
        ]
      : []),
  ])
  return unique
}
