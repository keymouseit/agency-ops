/**
 * Company holiday calendar (IST calendar dates).
 *
 * Source of truth: the `Holiday` table (prisma model Holiday), managed by
 * HR / Founder / Manager on /leaves/holidays and seeded with the 2026 KeyMouse IT
 * calendar in scripts/sql/release-db-changes.sql.
 *
 * Types:
 *   national / public → company-wide day off: no reminders, expected hours 0,
 *                        not counted as "missing plan".
 *   sunday            → listed for information (already a weekend).
 *   floating          → optional; a normal working day for everyone who has
 *                        not taken leave. Reminders still run (people on approved
 *                        leave are excluded as usual).
 *
 * Two read modes:
 *   - Display / reports (`listHolidays`, `getNonWorkingHolidayMap`): if the DB
 *     read fails (e.g. table not created yet) fall back to FALLBACK_HOLIDAYS so
 *     pages never break.
 *   - Reminder jobs (`checkReminderHoliday`): NO fallback — the caller must treat
 *     an error as "skip sending" so we never post a wrong reminder.
 */
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export * from '@/lib/holidays-shared'
import {
  dateKeyToDbDate,
  dbDateToDateKey,
  FALLBACK_HOLIDAYS,
  isHolidayType,
  isNonWorkingHolidayType,
  type HolidayEntry,
  UPCOMING_HOLIDAY_WINDOW_DAYS,
} from '@/lib/holidays-shared'

function toEntry(row: { id: string; date: Date; name: string; type: string }): HolidayEntry {
  return {
    id: row.id,
    date: dbDateToDateKey(row.date),
    name: row.name,
    type: isHolidayType(row.type) ? row.type : 'public',
  }
}

/** Strict DB read — throws on error. */
async function queryHolidays(fromKey?: string, toKey?: string): Promise<HolidayEntry[]> {
  const where: { date?: { gte?: Date; lte?: Date } } = {}
  if (fromKey || toKey) {
    where.date = {}
    if (fromKey) where.date.gte = dateKeyToDbDate(fromKey)
    if (toKey) where.date.lte = dateKeyToDbDate(toKey)
  }
  const rows = await prisma.holiday.findMany({ where, orderBy: { date: 'asc' } })
  return rows.map(toEntry)
}

/**
 * Holidays in [fromKey, toKey] inclusive (all types), oldest first.
 * Falls back to FALLBACK_HOLIDAYS if the table can't be read.
 */
export async function listHolidays(
  opts: { from?: string; to?: string } = {},
): Promise<{ holidays: HolidayEntry[]; source: 'db' | 'fallback' }> {
  const from = opts.from && opts.to && opts.from > opts.to ? opts.to : opts.from
  const to = opts.from && opts.to && opts.from > opts.to ? opts.from : opts.to
  try {
    return { holidays: await queryHolidays(from, to), source: 'db' }
  } catch (err) {
    logger.error('holidays: DB read failed — using built-in 2026 calendar', err as Error)
    return {
      holidays: FALLBACK_HOLIDAYS.filter(h => (!from || h.date >= from) && (!to || h.date <= to)),
      source: 'fallback',
    }
  }
}

/** dateKey → holiday name for company-wide days off (national / public / sunday) in range. */
export async function getNonWorkingHolidayMap(fromKey: string, toKey: string): Promise<Map<string, string>> {
  const { holidays } = await listHolidays({ from: fromKey, to: toKey })
  return new Map(holidays.filter(h => isNonWorkingHolidayType(h.type)).map(h => [h.date, h.name] as const))
}

/** The company-wide day-off holiday on one IST date, or null (display/report use). */
export async function getNonWorkingHoliday(dateKey: string): Promise<HolidayEntry | null> {
  const { holidays } = await listHolidays({ from: dateKey, to: dateKey })
  return holidays.find(h => isNonWorkingHolidayType(h.type)) ?? null
}

/** Next holidays (any type) from `fromKey` within `days` calendar days, inclusive. */
export async function getUpcomingHolidays(fromKey: string, days = UPCOMING_HOLIDAY_WINDOW_DAYS): Promise<HolidayEntry[]> {
  const end = new Date(dateKeyToDbDate(fromKey).getTime() + days * 86_400_000)
  const { holidays } = await listHolidays({ from: fromKey, to: dbDateToDateKey(end) })
  return holidays
}

export type ReminderHolidayCheck =
  | { skip: false; holiday: HolidayEntry | null }
  | { skip: true; reason: 'holiday'; holiday: HolidayEntry }
  | { skip: true; reason: 'holiday_check_failed'; holiday: null; error: string }

/**
 * Gate for reminder jobs. Fail-safe: if the Holiday table can't be read we
 * return skip:true (reason holiday_check_failed) — better to miss one reminder
 * than to ping everyone on a festival. Floating holidays do NOT skip.
 */
export async function checkReminderHoliday(dateKey: string, job: string): Promise<ReminderHolidayCheck> {
  try {
    const rows = await queryHolidays(dateKey, dateKey)
    const off = rows.find(h => isNonWorkingHolidayType(h.type))
    if (off) {
      logger.info(`${job}: skipped — holiday`, { dateKey, holiday: off.name, type: off.type })
      return { skip: true, reason: 'holiday', holiday: off }
    }
    return { skip: false, holiday: rows[0] ?? null }
  } catch (err) {
    logger.error(`${job}: holiday check failed — skipping send (fail-safe)`, err as Error, { dateKey })
    return {
      skip: true,
      reason: 'holiday_check_failed',
      holiday: null,
      error: err instanceof Error ? err.message.slice(0, 200) : 'unknown_error',
    }
  }
}

/** JSON body for a cron route that skipped because of a holiday gate. */
export function reminderSkipBody(check: Exclude<ReminderHolidayCheck, { skip: false }>, dateKey: string) {
  return check.reason === 'holiday'
    ? { ok: true, dateKey, skipped: 'holiday' as const, name: check.holiday.name, type: check.holiday.type }
    : { ok: true, dateKey, skipped: 'holiday_check_failed' as const, error: check.error }
}
