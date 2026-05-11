export const LEAD_SOURCES = ['Upwork', 'LinkedIn', 'Referral', 'Inbound', 'Direct'] as const
export const LEAD_STATUSES = ['new', 'proposal_sent', 'interview', 'won', 'lost'] as const
export const LOSS_REASONS = [
  'price_too_high', 'slow_response', 'weak_proposal',
  'trust_gap', 'tech_mismatch', 'lost_interview', 'no_response', 'other',
] as const
export const FAULT_AREAS = ['BD', 'Estimation', 'Communication', 'Proposal_Quality', 'External'] as const
export const PROJECT_STATUSES = ['scoping', 'active', 'qa', 'delivered', 'cancelled'] as const
export const ROLES = ['BD', 'Dev', 'Both', 'Founder', 'Manager', 'QA'] as const

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  proposal_sent: 'bg-purple-100 text-purple-800',
  interview: 'bg-amber-100 text-amber-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  scoping: 'bg-sky-100 text-sky-800',
  active: 'bg-blue-100 text-blue-800',
  qa: 'bg-violet-100 text-violet-800',
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

export function fmtCurrency(v: number | null, currency = 'USD') {
  if (!v) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
}

export function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: Date | string | null) {
  if (!d) return '—'
  const date = new Date(d)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
