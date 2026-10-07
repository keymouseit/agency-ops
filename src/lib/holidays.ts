/**
 * Company / Indian national holidays (IST calendar dates).
 * No Holiday model exists in Prisma yet — this is the attendance source of truth.
 *
 * Confirmed for KeyMouse IT / Indian national observance (2026):
 *   26 Jan · Republic Day
 *   15 Aug · Independence Day
 *   2 Oct  · Gandhi Jayanti
 *
 * TODO: confirm with HR before enabling any further dates (Diwali, Holi, Eid,
 * Christmas, state holidays, company offs, etc.).
 */

export type HolidayEntry = {
  /** YYYY-MM-DD in IST calendar */
  date: string
  name: string
  /** When false, listed for HR review only — not treated as a holiday yet. */
  confirmed: boolean
}

/** Confirmed + TODO candidates. Only `confirmed: true` affect attendance. */
export const HOLIDAYS_2026: HolidayEntry[] = [
  { date: '2026-01-26', name: 'Republic Day', confirmed: true },
  { date: '2026-08-15', name: 'Independence Day', confirmed: true },
  { date: '2026-10-02', name: 'Gandhi Jayanti', confirmed: true },
  // TODO: confirm with HR
  // { date: '2026-03-03', name: 'Holi', confirmed: false },
  // { date: '2026-03-31', name: 'Eid ul-Fitr', confirmed: false },
  // { date: '2026-11-08', name: 'Diwali', confirmed: false },
  // { date: '2026-12-25', name: 'Christmas', confirmed: false },
]

const CONFIRMED_BY_DATE = new Map(
  HOLIDAYS_2026.filter(h => h.confirmed).map(h => [h.date, h.name] as const),
)

export function isHoliday(dateKey: string): boolean {
  return CONFIRMED_BY_DATE.has(dateKey)
}

export function getHolidayName(dateKey: string): string | null {
  return CONFIRMED_BY_DATE.get(dateKey) ?? null
}

/** Confirmed holidays whose date falls in [fromKey, toKey] inclusive. */
export function holidaysInRange(fromKey: string, toKey: string): Array<{ date: string; name: string }> {
  const from = fromKey <= toKey ? fromKey : toKey
  const to = fromKey <= toKey ? toKey : fromKey
  return HOLIDAYS_2026.filter(h => h.confirmed && h.date >= from && h.date <= to).map(h => ({
    date: h.date,
    name: h.name,
  }))
}
