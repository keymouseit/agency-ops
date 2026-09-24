import { startOfDay } from 'date-fns'

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

export function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateEmailOrPhone(
  email: string | null | undefined,
  phone: string | null | undefined
): string | null {
  const e = email?.trim() ?? ''
  const p = phone?.trim() ?? ''

  if (e && !isValidEmail(e)) {
    return 'Enter a valid email address.'
  }
  if (p && !isValidPhone(p)) {
    return 'Enter a valid phone number (7–15 digits).'
  }
  return null
}

export function validateScheduledDateTime(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined
): string | null {
  if (!dateStr?.trim()) return 'Date is required.'

  const scheduledDate = startOfDay(new Date(`${dateStr}T00:00:00`))
  if (Number.isNaN(scheduledDate.getTime())) return 'Enter a valid date.'

  const today = startOfDay(new Date())
  if (scheduledDate < today) return 'Scheduled date cannot be in the past.'

  if (!timeStr?.trim()) return 'Time is required.'

  const scheduled = new Date(`${dateStr}T${timeStr}`)
  if (Number.isNaN(scheduled.getTime())) return 'Enter a valid time.'
  if (scheduled < new Date()) return 'Scheduled time cannot be in the past.'

  return null
}

export function validateLinkedInUrl(url: string | null | undefined): string | null {
  const value = url?.trim() ?? ''
  if (!value) return null
  if (!isValidUrl(value)) return 'Enter a valid LinkedIn URL (https://...).'
  return null
}

export function validateCampaignName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? ''
  if (!trimmed) return 'Campaign name is required.'
  if (trimmed.length < 2) return 'Campaign name must be at least 2 characters.'
  return null
}

export function validateCampaignDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string | null {
  const startRaw = startDate?.trim() ?? ''
  const endRaw = endDate?.trim() ?? ''

  if (!startRaw) return 'Start date is required.'
  if (!endRaw) return 'End date is required.'

  const start = new Date(`${startRaw}T00:00:00`)
  const end = new Date(`${endRaw}T00:00:00`)

  if (Number.isNaN(start.getTime())) return 'Enter a valid start date.'
  if (Number.isNaN(end.getTime())) return 'Enter a valid end date.'
  if (end < start) return 'End date must be on or after start date.'
  return null
}

export function validateRequiredSelect(
  value: string | null | undefined,
  label: string
): string | null {
  if (!value?.trim()) return `${label} is required.`
  return null
}

/** Plain decimal hours (e.g. 2, 0.25, 2.5). */
const HOURS_PATTERN = /^-?\d+(\.\d+)?$/
/** Minutes shorthand: 15m, 30 min, 90 minutes → hours. */
const MINUTES_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(?:m|mins?|minutes?)$/i
/** Optional hours suffix: 2h, 0.25 hours. */
const HOURS_SUFFIX_PATTERN = /^(-?\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)$/i

export type ParseHoursOk = { ok: true; value: number | null }
export type ParseHoursErr = { ok: false; error: string }
export type ParseHoursResult = ParseHoursOk | ParseHoursErr

const HOURS_EXAMPLES = '0.25, 15m, 0.5, or 2'

/**
 * Format decimal hours for UI (Day load, submit button).
 * Rounds to 2dp to avoid float noise; keeps quarter-hours readable (0.25).
 */
export function formatHoursAmount(hours: number): string {
  if (!Number.isFinite(hours)) return '0'
  const rounded = Math.round(hours * 100) / 100
  return String(rounded)
}

/**
 * Parse optional decimal hours from form/API input.
 * Empty → null. Accepts plain decimals (0.25), optional h/hrs suffix, or minutes (15m).
 * Rejects time-like strings (2:30), NaN, Infinity, and scientific notation.
 */
export function parseHoursInput(
  raw: unknown,
  opts: {
    label?: string
    /** Inclusive minimum. Default 0. Ignored when minExclusive is set. */
    min?: number
    /** When set, value must be strictly greater than this (typical: 0 for logged hours). */
    minExclusive?: number
    max?: number
  } = {},
): ParseHoursResult {
  const label = opts.label ?? 'Hours'
  const max = opts.max ?? 999

  if (raw === null || raw === undefined) return { ok: true, value: null }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return { ok: false, error: `${label} must be a valid number.` }
    return finalizeHours(raw, label, opts, max)
  }

  const str = String(raw).trim()
  if (str === '') return { ok: true, value: null }

  if (str.includes(':')) {
    return {
      ok: false,
      error: `${label} must be decimal hours or minutes (for example ${HOURS_EXAMPLES}), not a time like 2:30.`,
    }
  }

  const minutesMatch = str.match(MINUTES_PATTERN)
  if (minutesMatch) {
    const mins = Number(minutesMatch[1])
    if (!Number.isFinite(mins)) {
      return { ok: false, error: `${label} must be a valid number.` }
    }
    return finalizeHours(mins / 60, label, opts, max)
  }

  const hoursSuffixMatch = str.match(HOURS_SUFFIX_PATTERN)
  if (hoursSuffixMatch) {
    const hours = Number(hoursSuffixMatch[1])
    if (!Number.isFinite(hours)) {
      return { ok: false, error: `${label} must be a valid number.` }
    }
    return finalizeHours(hours, label, opts, max)
  }

  if (!HOURS_PATTERN.test(str)) {
    return {
      ok: false,
      error: `${label} must be a valid number (for example ${HOURS_EXAMPLES}).`,
    }
  }

  const num = Number(str)
  if (!Number.isFinite(num)) {
    return { ok: false, error: `${label} must be a valid number.` }
  }

  return finalizeHours(num, label, opts, max)
}

function finalizeHours(
  num: number,
  label: string,
  opts: { min?: number; minExclusive?: number },
  max: number,
): ParseHoursResult {
  if (opts.minExclusive !== undefined) {
    if (!(num > opts.minExclusive)) {
      return {
        ok: false,
        error:
          opts.minExclusive === 0
            ? `${label} must be greater than 0.`
            : `${label} must be greater than ${opts.minExclusive}.`,
      }
    }
  } else {
    const min = opts.min ?? 0
    if (num < min) {
      return {
        ok: false,
        error: min === 0 ? `${label} cannot be negative.` : `${label} must be at least ${min}.`,
      }
    }
  }

  if (num > max) {
    return { ok: false, error: `${label} cannot exceed ${max}.` }
  }

  return { ok: true, value: num }
}

/** Require a positive hours value (empty is an error). */
export function parseRequiredPositiveHours(
  raw: unknown,
  label = 'Hours',
): { ok: true; value: number } | ParseHoursErr {
  const parsed = parseHoursInput(raw, { label, minExclusive: 0 })
  if (!parsed.ok) return parsed
  if (parsed.value === null) {
    return { ok: false, error: `${label} is required.` }
  }
  return { ok: true, value: parsed.value }
}
