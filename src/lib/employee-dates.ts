/**
 * Employee date helpers (birthdays, work anniversaries).
 *
 * All calendar math is done on the IST (Asia/Kolkata) calendar day, so a date
 * stored as UTC midnight (`new Date('2026-03-15')`) or any time of day maps to
 * the day people in the office actually see. Pure functions with no DB access, so
 * they can be reused by a future birthday / anniversary email cron.
 *
 * Feb 29 dates fall on Feb 28 in non-leap years.
 */
import { IST_TIMEZONE } from '@/lib/ist'

export type CalendarDate = { year: number; month: number; day: number } // month 1–12

export type Occurrence = CalendarDate & {
  /** UTC midnight of the occurrence's calendar day (formats to the same day in IST). */
  date: Date
  /** Whole days from today (IST) to the occurrence; 0 = today. */
  daysUntil: number
  isToday: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Calendar date (year, month, day) of `date` in IST. */
export function istCalendarDate(date: Date | string): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date(date))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Month/day of `source` placed in `year` (Feb 29 → Feb 28 when `year` is not a leap year). */
export function occurrenceInYear(source: CalendarDate, year: number): CalendarDate {
  if (source.month === 2 && source.day === 29 && !isLeapYear(year)) {
    return { year, month: 2, day: 28 }
  }
  return { year, month: source.month, day: source.day }
}

function dayNumber(d: CalendarDate): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / DAY_MS)
}

function compare(a: CalendarDate, b: CalendarDate): number {
  return dayNumber(a) - dayNumber(b)
}

/**
 * Next occurrence (today or later, IST) of the month/day of `date`.
 * `minYear` lets anniversaries skip years before the first one is due.
 */
export function nextOccurrence(
  date: Date | string,
  today: Date | string = new Date(),
  opts: { minYear?: number } = {},
): Occurrence {
  const source = istCalendarDate(date)
  const now = istCalendarDate(today)
  let year = Math.max(now.year, opts.minYear ?? now.year)
  let occ = occurrenceInYear(source, year)
  if (compare(occ, now) < 0) {
    year += 1
    occ = occurrenceInYear(source, year)
  }
  const daysUntil = dayNumber(occ) - dayNumber(now)
  return {
    ...occ,
    date: new Date(Date.UTC(occ.year, occ.month - 1, occ.day)),
    daysUntil,
    isToday: daysUntil === 0,
  }
}

/** True when today (IST) is the birthday / anniversary day of `date` (Feb 29 → Feb 28 rule applies). */
export function isOccurrenceToday(date: Date | string, today: Date | string = new Date()): boolean {
  const now = istCalendarDate(today)
  const occ = occurrenceInYear(istCalendarDate(date), now.year)
  return compare(occ, now) === 0
}

/** Full years completed from `start` up to `asOf` (IST calendar days). 0 if `start` is in the future. */
export function yearsCompleted(start: Date | string, asOf: Date | string = new Date()): number {
  const s = istCalendarDate(start)
  const now = istCalendarDate(asOf)
  if (compare(s, now) > 0) return 0
  let years = now.year - s.year
  if (compare(occurrenceInYear(s, now.year), now) > 0) years -= 1
  return Math.max(0, years)
}

/**
 * Next work anniversary (first one is one year after `joiningDate`) and the
 * number of years it marks.
 */
export function nextWorkAnniversary(
  joiningDate: Date | string,
  today: Date | string = new Date(),
): Occurrence & { years: number } {
  const start = istCalendarDate(joiningDate)
  const occ = nextOccurrence(joiningDate, today, { minYear: start.year + 1 })
  return { ...occ, years: occ.year - start.year }
}

/** "today", "tomorrow", "in 12 days" */
export function describeDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  return `in ${daysUntil} days`
}

/** "YYYY-MM-DD" of `date`'s IST calendar day (used as an idempotency key by celebration emails). */
export function istDateKey(date: Date | string = new Date()): string {
  const { year, month, day } = istCalendarDate(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Instant inside the IST calendar day "YYYY-MM-DD" (noon IST), or null if the
 * string is not a real date. Handy for "pretend today is …" overrides.
 */
export function parseIstDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const probe = new Date(Date.UTC(year, month - 1, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null
  }
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00+05:30`)
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11 → "11th", 12 → "12th", 13 → "13th", 21 → "21st" … */
export function ordinal(n: number): string {
  const mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/**
 * Years completed if today (IST) is a work anniversary of `joiningDate`
 * (Feb 29 → Feb 28 rule), otherwise null. The joining day itself (year 0) is
 * not an anniversary, and neither is a missing joiningDate.
 */
export function workAnniversaryYearsToday(
  joiningDate: Date | string | null | undefined,
  today: Date | string = new Date(),
): number | null {
  if (!joiningDate) return null
  if (!isOccurrenceToday(joiningDate, today)) return null
  const years = yearsCompleted(joiningDate, today)
  return years >= 1 ? years : null
}
