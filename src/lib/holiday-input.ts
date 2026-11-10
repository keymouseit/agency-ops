import { HOLIDAY_TYPES, isDateKey, isHolidayType, type HolidayType } from '@/lib/holidays'

export const HOLIDAY_NAME_MAX = 100
export const HOLIDAY_MIN_YEAR = 2020
export const HOLIDAY_MAX_YEAR = 2100

export type HolidayInput = { date: string; name: string; type: HolidayType }

/** Validate a holiday body. `partial` allows any subset of fields (PATCH). */
export function parseHolidayInput(
  body: unknown,
  partial = false,
): { value: Partial<HolidayInput> } | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const out: Partial<HolidayInput> = {}

  if (b.date !== undefined || !partial) {
    if (!isDateKey(b.date)) return { error: 'Pick a valid date (YYYY-MM-DD).' }
    const year = Number((b.date as string).slice(0, 4))
    if (year < HOLIDAY_MIN_YEAR || year > HOLIDAY_MAX_YEAR) {
      return { error: `Year must be between ${HOLIDAY_MIN_YEAR} and ${HOLIDAY_MAX_YEAR}.` }
    }
    out.date = b.date as string
  }
  if (b.name !== undefined || !partial) {
    const name = typeof b.name === 'string' ? b.name.trim() : ''
    if (!name) return { error: 'Holiday name is required.' }
    if (name.length > HOLIDAY_NAME_MAX) return { error: `Name must be ${HOLIDAY_NAME_MAX} characters or fewer.` }
    out.name = name
  }
  if (b.type !== undefined || !partial) {
    if (!isHolidayType(b.type)) return { error: `Type must be one of: ${HOLIDAY_TYPES.join(', ')}.` }
    out.type = b.type
  }
  return { value: out }
}

export function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'P2002'
}
