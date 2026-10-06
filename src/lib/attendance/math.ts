import {
  FULL_DAY_LEAVE_TYPES,
  HALF_DAY_LEAVE_HOURS,
  SHORT_LEAVE_HOURS,
} from '@/lib/expected-hours'
import { isHoliday } from '@/lib/holidays'
import type { AttendanceDayRow, AttendanceStatus } from './types'

/** Attendance sheet target shift length (ported from attendance-dashboard). */
export const ATTENDANCE_TARGET_HOURS = 9
export const ATTENDANCE_TARGET_SECONDS = ATTENDANCE_TARGET_HOURS * 3600

export function timeToSeconds(timeStr: string | null | undefined): number {
  if (!timeStr) return 0
  const cleaned = timeStr.trim()
  if (!cleaned) return 0
  const neg = cleaned.startsWith('-')
  const raw = neg ? cleaned.slice(1) : cleaned
  const [hRaw, mRaw] = raw.split(':')
  const h = Number(hRaw) || 0
  const m = Number(mRaw) || 0
  const sec = h * 3600 + m * 60
  return neg ? -sec : sec
}

export function secondsToTime(totalSeconds: number): string {
  const neg = totalSeconds < 0
  const abs = Math.abs(Math.round(totalSeconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  return `${neg ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`
}

/** Pure calendar weekday for an IST YYYY-MM-DD key (Sat/Sun = weekend). */
export function isWeekendDateKey(dateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return false
  const [y, m, d] = dateKey.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return day === 0 || day === 6
}

/** Weekend or confirmed company/national holiday — no shortage expected. */
export function isNonWorkingDateKey(dateKey: string): boolean {
  return isWeekendDateKey(dateKey) || isHoliday(dateKey)
}

/**
 * Inclusive Mon–Fri keys between from/to (IST calendar keys).
 * Holidays are included so the sheet can render a holiday banner / workers who came in.
 */
export function weekdayKeysInRange(fromKey: string, toKey: string): string[] {
  const keys: string[] = []
  let cur = fromKey
  while (cur <= toKey) {
    if (!isWeekendDateKey(cur)) keys.push(cur)
    const [y, m, d] = cur.split('-').map(Number)
    cur = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  }
  return keys
}

/**
 * Leave hours credited on the attendance sheet for an approved leave type.
 * WFH = 0 (working day). Full-day types cover the full attendance target (9h).
 */
export function leaveHoursForApprovedType(leaveType: string | null | undefined): number {
  if (!leaveType || leaveType === 'work_from_home') return 0
  if (leaveType === 'short_leave') return SHORT_LEAVE_HOURS
  if (leaveType === 'half_day') return HALF_DAY_LEAVE_HOURS
  if ((FULL_DAY_LEAVE_TYPES as readonly string[]).includes(leaveType)) {
    return ATTENDANCE_TARGET_HOURS
  }
  // Unknown leave types treated as full-day balance leaves.
  return ATTENDANCE_TARGET_HOURS
}

export function isFullDayAttendanceLeave(leaveType: string | null | undefined): boolean {
  if (!leaveType || leaveType === 'work_from_home') return false
  if (leaveType === 'short_leave' || leaveType === 'half_day') return false
  return true
}

export function leaveTypeDisplayLabel(leaveType: string | null | undefined, timeSlot?: string | null): string {
  if (!leaveType) return 'Leave'
  if (leaveType === 'short_leave') {
    const slot = timeSlot ? timeSlot.replace(/_/g, ' ') : ''
    return slot ? `Short leave · ${slot}` : 'Short leave'
  }
  if (leaveType === 'half_day') {
    const slot = timeSlot ? timeSlot.replace(/_/g, ' ') : ''
    return slot ? `Half day · ${slot}` : 'Half day'
  }
  if (leaveType === 'birthday_leave') return 'Birthday leave'
  if (leaveType === 'comp_off_leave') return 'Comp Off leave'
  if (leaveType === 'work_from_home') return 'WFH'
  if (leaveType === 'full_day') return 'Full day leave'
  return leaveType.replace(/_/g, ' ')
}

export function computeDayStatus(opts: {
  grossTwh: string
  leaveHours: string
  leaveType: string | null
  hasActivity: boolean
  fixedHours: boolean
}): { status: AttendanceStatus; swh: string } {
  const { grossTwh, leaveHours, leaveType, hasActivity, fixedHours } = opts

  if (isFullDayAttendanceLeave(leaveType)) {
    return { status: 'Leave', swh: '0:00' }
  }

  const grossSec = timeToSeconds(grossTwh)
  const leaveSec = timeToSeconds(leaveHours)
  const total = grossSec + leaveSec

  if (!hasActivity && !fixedHours && leaveSec <= 0) {
    return { status: 'Absent', swh: secondsToTime(ATTENDANCE_TARGET_SECONDS) }
  }

  if (total >= ATTENDANCE_TARGET_SECONDS) {
    return { status: 'OK', swh: '0:00' }
  }
  return { status: 'Short', swh: secondsToTime(ATTENDANCE_TARGET_SECONDS - total) }
}

/**
 * Running PSW/TSWH balance across sorted rows (by date then empNo).
 * Daily diff = target − (gross + leave); EBH adds to shortage; surplus clamped to 0.
 */
export function applyRunningBalance<T extends AttendanceDayRow>(rows: T[]): T[] {
  const sorted = [...rows]
    .filter(r => !isWeekendDateKey(r.date))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.empNo - b.empNo || a.name.localeCompare(b.name)
    })

  const balances: Record<string, number> = {}

  return sorted.map(rec => {
    let dailyDiff = 0
    // Holidays: pass through — no shortage, no surplus (surplus already clamped to 0).
    if (rec.isHoliday || isHoliday(rec.date)) {
      dailyDiff = 0
    } else if (rec.status === 'Leave') {
      dailyDiff = 0
    } else if (rec.status === 'Absent') {
      dailyDiff = ATTENDANCE_TARGET_SECONDS
    } else {
      const worked = timeToSeconds(rec.grossTwh) + timeToSeconds(rec.leaveHours)
      dailyDiff = ATTENDANCE_TARGET_SECONDS - worked
    }

    const current = balances[rec.memberId] || 0
    // EBH on a holiday also does not change the running shortage balance.
    const ebhSec = rec.isHoliday || isHoliday(rec.date) ? 0 : timeToSeconds(rec.ebh)
    let next = current + dailyDiff + ebhSec
    if (next < 0) next = 0
    balances[rec.memberId] = next

    return {
      ...rec,
      psw: current === 0 ? '0:00' : secondsToTime(current),
      tswh: next === 0 ? '0:00' : secondsToTime(next),
    }
  })
}

export function hasOutstandingShortage(row: AttendanceDayRow): boolean {
  if (row.isHoliday || isHoliday(row.date)) return false
  if (row.status === 'Leave' || row.status === 'Absent') return false
  if (row.status === 'Short') return true
  return Boolean(row.tswh && row.tswh !== '0:00')
}

/**
 * Row background aligned with Leave calendar legend:
 * full day red · half day light red · short leave sky · WFH teal ·
 * absent orange · hours shortfall yellow.
 */
export function attendanceRowBgClass(row: AttendanceDayRow): string {
  if (row.status === 'Absent') return 'bg-orange-50'
  if (row.leaveType === 'short_leave') return 'bg-sky-100'
  if (row.leaveType === 'half_day') return 'bg-red-100'
  if (row.leaveType === 'work_from_home') return 'bg-teal-100'
  if (
    row.status === 'Leave' ||
    row.leaveType === 'full_day' ||
    row.leaveType === 'birthday_leave' ||
    row.leaveType === 'comp_off_leave'
  ) {
    return 'bg-red-50'
  }
  if (hasOutstandingShortage(row)) return 'bg-yellow-50'
  return 'bg-white'
}

/** Excel fill hex (no #) matching attendanceRowBgClass. */
export function attendanceRowBgHex(row: AttendanceDayRow): string {
  if (row.status === 'Absent') return 'FFF7ED' // orange-50
  if (row.leaveType === 'short_leave') return 'E0F2FE' // sky-100
  if (row.leaveType === 'half_day') return 'FEE2E2' // red-100
  if (row.leaveType === 'work_from_home') return 'CCFBF1' // teal-100
  if (
    row.status === 'Leave' ||
    row.leaveType === 'full_day' ||
    row.leaveType === 'birthday_leave' ||
    row.leaveType === 'comp_off_leave'
  ) {
    return 'FEF2F2' // red-50
  }
  if (hasOutstandingShortage(row)) return 'FEF9C3' // yellow-100 (readable vs old FFFF00)
  return 'FFFFFF'
}

export function sumTswhSeconds(rows: AttendanceDayRow[]): number {
  // Final TSWH per member (last day in range)
  const lastByMember = new Map<string, string>()
  for (const r of rows) {
    lastByMember.set(r.memberId, r.tswh)
  }
  let sum = 0
  for (const t of lastByMember.values()) sum += timeToSeconds(t)
  return sum
}
