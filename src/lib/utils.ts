import { startOfWeek } from 'date-fns'
import { formatIstDate, formatIstDateTime, istHour } from '@/lib/ist'

export const LEAD_SOURCES = ['Upwork', 'LinkedIn', 'Referral', 'Inbound', 'Direct'] as const
export const MOM_MEETING_TYPES = ['Discovery Call', 'Demo', 'Follow-up', 'Proposal Discussion'] as const
export const MOM_FINAL_STATUSES = ['Active', 'Hold', 'Closed'] as const

export const INDUSTRIES = [
  'Healthcare',
  'FinTech',
  'E-commerce',
  'EdTech',
  'SaaS',
  'Real Estate',
  'Travel & Hospitality',
  'Logistics & Supply Chain',
  'Media & Entertainment',
  'Manufacturing',
  'Retail',
  'Automotive',
  'Insurance',
  'Banking',
  'Marketing & Advertising',
  'Non-profit',
  'Government',
  'Energy & Utilities',
  'Telecommunications',
  'Food & Beverage',
  'Fitness & Wellness',
  'Legal',
  'Human Resources',
  'Gaming',
  'Other',
] as const

export const MOM_MEETING_TYPE_COLORS: Record<string, string> = {
  'Discovery Call': 'bg-violet-100 text-violet-800',
  'Demo': 'bg-blue-100 text-blue-800',
  'Follow-up': 'bg-amber-100 text-amber-800',
  'Proposal Discussion': 'bg-green-100 text-green-800',
}

export const MOM_FINAL_STATUS_COLORS: Record<string, string> = {
  Active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Hold: 'bg-amber-50 text-amber-800 border-amber-200',
  Closed: 'bg-slate-100 text-slate-700 border-slate-200',
}

export const ROLE_COLORS: Record<string, string> = {
  Founder:      'bg-purple-100 text-purple-800',
  Manager:      'bg-indigo-100 text-indigo-800',
  BD:           'bg-blue-100 text-blue-800',
  Dev:          'bg-green-100 text-green-800',
  QA:           'bg-teal-100 text-teal-800',
  HR:           'bg-rose-100 text-rose-800',
  SocialMedia:  'bg-pink-100 text-pink-800',
  Both:         'bg-amber-100 text-amber-800',
}
export const LEAD_STATUSES = ['new', 'proposal_sent', 'interview', 'won', 'lost'] as const
export const LOSS_REASONS = [
  'price_too_high', 'slow_response', 'weak_proposal',
  'trust_gap', 'tech_mismatch', 'lost_interview', 'no_response', 'other',
] as const

export const LOSS_REASON_LABELS: Record<string, string> = {
  price_too_high: 'Budget too high',
  slow_response: 'Delayed response',
  weak_proposal: 'Weak proposal',
  trust_gap: 'Trust gap',
  tech_mismatch: 'Tech mismatch',
  lost_interview: 'Lost at interview',
  no_response: 'No response',
  other: 'Other',
}

export function formatLossReason(reason: string) {
  return LOSS_REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')
}
export const FAULT_AREAS = ['BD', 'Estimation', 'Communication', 'Proposal_Quality', 'External'] as const
export const PROJECT_STATUSES = [
  'scoping',
  'active',
  'qa',
  'on_hold',
  'maintenance',
  'delivered',
  'cancelled',
] as const

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  scoping: 'Scoping',
  active: 'Active',
  qa: 'QA',
  on_hold: 'On Hold',
  maintenance: 'Maintenance',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const ROLES = ['BD', 'Dev', 'Both', 'Founder', 'Manager', 'QA', 'HR', 'SocialMedia'] as const

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  proposal_sent: 'bg-purple-100 text-purple-800',
  interview: 'bg-amber-100 text-amber-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  scoping: 'bg-sky-100 text-sky-800',
  active: 'bg-blue-100 text-blue-800',
  qa: 'bg-violet-100 text-violet-800',
  on_hold: 'bg-amber-100 text-amber-800',
  maintenance: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  yes: 'bg-green-100 text-green-800',
  at_risk: 'bg-amber-100 text-amber-800',
  no: 'bg-red-100 text-red-800',
}

export function scoreColor(s: number) {
  if (s >= 8) return 'text-green-700'
  if (s >= 6) return 'text-amber-700'
  return 'text-red-600'
}

export function scoreBg(s: number) {
  if (s >= 8) return 'bg-green-50 text-green-800'
  if (s >= 6) return 'bg-amber-50 text-amber-800'
  return 'bg-red-50 text-red-800'
}

export function avg(nums: number[]) {
  if (!nums.length) return 0
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

export function timeGreeting(date = new Date()) {
  const hour = istHour(date)
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function fmtCurrency(v: number | null | undefined, currency = 'USD') {
  if (v == null || Number.isNaN(v)) return '—'
  const code = (currency || 'USD').trim().toUpperCase()
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      maximumFractionDigits: 0,
    }).format(v)
  } catch {
    return `${code} ${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  }
}

export function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return formatIstDate(d)
}

export function fmtDateTime(d: Date | string | null) {
  if (!d) return '—'
  return formatIstDateTime(d)
}

/** Monday 00:00 — canonical week boundary for check-ins and scores */
export function getWeekStart(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 })
}

export function isSameWeek(a: Date | string, b: Date | string) {
  return getWeekStart(new Date(a)).getTime() === getWeekStart(new Date(b)).getTime()
}

/** Client-safe unique id; works on HTTP where crypto.randomUUID may be unavailable. */
export function createClientId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}
