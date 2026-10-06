/**
 * Hardcoded fallbacks from attendance-dashboard (including uncommitted Sushant override).
 * Used until TeamMember attendance* / ssmEmploymentId fields are filled after migration.
 */
import { employeeStaffNo } from '@/lib/employee-order'

/** Name-substring → official sheet EMP No (from attendance-dashboard getEmployeeSheetId). */
const SHEET_ID_RULES: Array<{ test: (n: string) => boolean; id: number }> = [
  { test: n => n.includes('manjinder'), id: 111 },
  { test: n => n.includes('gaurav'), id: 114 },
  {
    test: n => n.includes('vishal sharma') || (n.includes('vishal') && !n.includes('ghangale') && !/\bvishal g\b/.test(n)),
    id: 116,
  },
  { test: n => n.includes('harpreet'), id: 154 },
  { test: n => n.includes('vikas'), id: 180 },
  { test: n => n.includes('sumeer'), id: 194 },
  { test: n => n.includes('sushant'), id: 199 },
  { test: n => n.includes('reema'), id: 204 },
  { test: n => n.includes('gurleen'), id: 206 },
  { test: n => n.includes('sonal'), id: 211 },
  { test: n => n.includes('vinayak'), id: 212 },
  { test: n => n.includes('vipul'), id: 217 },
  { test: n => n.includes('vikram') && n.includes('sr'), id: 229 },
  { test: n => n.includes('vikram'), id: 219 },
  { test: n => n.includes('saqeeb'), id: 226 },
  { test: n => n.includes('ankit'), id: 227 },
  { test: n => n.includes('deepanshu'), id: 230 },
  { test: n => n.includes('ghangale') || n.includes('vishal ghangale') || /\bvishal g\b/.test(n), id: 231 },
]

export function fallbackEmpNo(name: string, originalId?: number): number {
  const fromOrder = employeeStaffNo(name)
  if (fromOrder != null) return fromOrder

  const normalized = name.toLowerCase().trim()
  for (const rule of SHEET_ID_RULES) {
    if (rule.test(normalized)) return rule.id
  }
  return originalId && Number.isFinite(originalId) ? originalId : 0
}

/** Case-insensitive: first token is shiven, or name/email contains "shiven". */
export function nameLooksLikeShiven(name?: string, email?: string): boolean {
  const nameNorm = (name || '').toLowerCase().trim()
  const emailNorm = (email || '').toLowerCase().trim()
  if (emailNorm.startsWith('shiven@') || emailNorm.includes('shiven@')) return true
  if (!nameNorm) return false
  if (nameNorm.includes('shiven')) return true
  const first = nameNorm.split(/\s+/)[0] || ''
  return first === 'shiven'
}

/**
 * Built-in exclusions (attendance-dashboard + Founder).
 * Always applied — DB `attendanceExcluded: false` must not override these.
 * Sushant intentionally NOT excluded (uncommitted attendance-dashboard change).
 */
export function fallbackIsExcluded(name?: string, email?: string, role?: string): boolean {
  const nameNorm = (name || '').toLowerCase().trim()
  const emailNorm = (email || '').toLowerCase().trim()
  if (role === 'Founder') return true
  if (nameLooksLikeShiven(name, email)) return true
  return (
    nameNorm.includes('harshils@keymouseit.com') ||
    emailNorm.includes('harshils@keymouseit.com')
  )
}

/**
 * Final sheet exclusion: built-in rules OR explicit DB opt-out.
 * Never treat attendanceExcluded=false as “include despite shiven/Founder”.
 */
export function shouldExcludeFromAttendance(opts: {
  name: string
  email?: string | null
  role?: string | null
  attendanceExcluded?: boolean | null
}): boolean {
  if (fallbackIsExcluded(opts.name, opts.email ?? undefined, opts.role ?? undefined)) return true
  if (opts.attendanceExcluded === true) return true
  return false
}

export function fallbackIsSushant(name?: string): boolean {
  return (name || '').toLowerCase().trim().includes('sushant')
}

/** Static present day for Sushant: C-In 12:00, C-Out 21:00 (from uncommitted actions.ts). */
export const SUSHANT_FIXED_START = '12:00'
export const SUSHANT_FIXED_END = '21:00'

export function fallbackFixedHours(name?: string): { start: string; end: string } | null {
  if (fallbackIsSushant(name)) {
    return { start: SUSHANT_FIXED_START, end: SUSHANT_FIXED_END }
  }
  return null
}

/** Fuzzy name match between TeamMember and ScreenshotMonitor employment name. */
export function namesLikelyMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim()
  const nb = b.toLowerCase().trim()
  if (!na || !nb) return false
  if (na === nb) return true
  if (na.includes(nb) || nb.includes(na)) return true
  const fa = na.split(/\s+/)[0]
  const fb = nb.split(/\s+/)[0]
  if (fa.length >= 4 && fa === fb) {
    // Ambiguous first names (Vishal, Vikram) need last-name help
    if (fa === 'vishal' || fa === 'vikram') {
      const la = na.split(/\s+/).slice(-1)[0]
      const lb = nb.split(/\s+/).slice(-1)[0]
      return la === lb || la.startsWith(lb) || lb.startsWith(la)
    }
    return true
  }
  return false
}
