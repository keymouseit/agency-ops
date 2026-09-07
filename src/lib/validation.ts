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
