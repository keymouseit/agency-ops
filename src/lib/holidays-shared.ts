/**
 * Client-safe holiday types and helpers (no Prisma import).
 * Server code should import from '@/lib/holidays', which re-exports all of this.
 */
export const HOLIDAY_TYPES = ['national', 'public', 'floating', 'sunday'] as const
export type HolidayType = (typeof HOLIDAY_TYPES)[number]

export const HOLIDAY_TYPE_LABELS: Record<HolidayType, string> = {
  national: 'National Holiday',
  public: 'Public Holiday',
  floating: 'Floating Holiday',
  sunday: 'Sunday',
}

/** Company-wide days off. Floating holidays are optional, so not included. */
export const NON_WORKING_HOLIDAY_TYPES: readonly HolidayType[] = ['national', 'public', 'sunday']

/** Dashboard countdown (/ and /me) shows the next holiday only when it is this many days away or fewer. */
export const UPCOMING_HOLIDAY_WINDOW_DAYS = 15

/** Whole IST calendar days from `fromKey` to `toKey` (both YYYY-MM-DD). 0 = same day. */
export function daysBetweenDateKeys(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000,
  )
}

/** Who can add / edit / delete holidays. */
export const HOLIDAY_EDITOR_ROLES = ['Founder', 'Manager', 'HR']

export function canManageHolidays(role: string | null | undefined): boolean {
  return !!role && HOLIDAY_EDITOR_ROLES.includes(role)
}

export function isHolidayType(value: unknown): value is HolidayType {
  return typeof value === 'string' && (HOLIDAY_TYPES as readonly string[]).includes(value)
}

export function isNonWorkingHolidayType(type: string): boolean {
  return (NON_WORKING_HOLIDAY_TYPES as readonly string[]).includes(type)
}

export type HolidayEntry = {
  id: string
  /** YYYY-MM-DD in IST calendar */
  date: string
  name: string
  type: HolidayType
}

/**
 * KeyMouse IT Holiday Calendar 2026 — same rows as the SQL seed.
 * Only used when the Holiday table can't be read (display/report fallback).
 */
export const FALLBACK_HOLIDAYS: HolidayEntry[] = [
  { id: 'hol_2026_01_26', date: '2026-01-26', name: 'Republic Day', type: 'national' },
  { id: 'hol_2026_03_04', date: '2026-03-04', name: 'Holi', type: 'public' },
  { id: 'hol_2026_08_28', date: '2026-08-28', name: 'Raksha Bandhan', type: 'floating' },
  { id: 'hol_2026_10_02', date: '2026-10-02', name: 'Mahatma Gandhi Jayanti', type: 'national' },
  { id: 'hol_2026_10_20', date: '2026-10-20', name: 'Dussehra', type: 'public' },
  { id: 'hol_2026_11_08', date: '2026-11-08', name: 'Diwali (Lakshmi Pooja)', type: 'sunday' },
  { id: 'hol_2026_11_09', date: '2026-11-09', name: 'Diwali (Vishwakarma)', type: 'public' },
  { id: 'hol_2026_11_24', date: '2026-11-24', name: 'Guru Nanak Jayanti', type: 'floating' },
  { id: 'hol_2026_12_25', date: '2026-12-25', name: 'Christmas Day', type: 'public' },
]

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** Holiday.date is a Postgres DATE → Prisma gives UTC midnight. */
export function dateKeyToDbDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`)
}

export function dbDateToDateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}
