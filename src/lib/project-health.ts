import { differenceInDays } from 'date-fns'

export type HealthLabel = 'healthy' | 'at_risk' | 'critical'

export type HealthResult = { score: number; label: HealthLabel }

type HealthInput = {
  estimatedEnd: Date | null
  startDate: Date | null
  estimatedHours: number | null
  actualHours: number | null
  milestones: { status: string }[]
  checkIns: { onTrack: string; clientUpdated: boolean; blockers: string | null }[]
  postDeliveryIssues?: { id: string }[]
  scopeChanges: { changeOrderSigned: boolean }[]
}

export function calcHealth(p: HealthInput): HealthResult {
  let score = 10
  const now = new Date()

  if (p.estimatedEnd) {
    const daysLeft = differenceInDays(new Date(p.estimatedEnd), now)
    const ci = (p.checkIns || [])[0]
    if (ci?.onTrack === 'no') score -= 3
    else if (ci?.onTrack === 'at_risk') score -= 1.5
    else if (daysLeft < 0) score -= 2
  }

  if (p.estimatedHours && p.actualHours) {
    const pct = p.actualHours / p.estimatedHours
    if (pct > 1.4) score -= 2
    else if (pct > 1.2) score -= 1
  }

  const missed = (p.milestones || []).filter(m => m.status === 'missed').length
  if (missed > 0) score -= Math.min(1.5, missed * 0.5)

  const clientIssues = (p.postDeliveryIssues ?? []).length
  score -= Math.min(1, clientIssues * 0.5)

  const ci = (p.checkIns || [])[0]
  if (ci && !ci.clientUpdated) score -= 0.5
  if (ci?.blockers && ci.blockers.trim()) score -= 0.3

  const unsigned = (p.scopeChanges || []).filter(s => !s.changeOrderSigned).length
  if (unsigned > 0) score -= 0.5

  const clamped = Math.max(0, Math.round(score * 10) / 10)
  // ≤5 critical (red) · >5–<7.5 at risk (amber) · ≥7.5 healthy (green)
  const label: HealthLabel =
    clamped >= 7.5 ? 'healthy' : clamped > 5 ? 'at_risk' : 'critical'

  return { score: clamped, label }
}

export function healthColor(label: HealthLabel) {
  return label === 'healthy' ? 'text-green-700' : label === 'at_risk' ? 'text-amber-700' : 'text-red-600'
}

export function healthBg(label: HealthLabel) {
  return label === 'healthy' ? 'bg-green-50 border-green-200' : label === 'at_risk' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
}

export function compareProjectHealth(a: HealthResult, b: HealthResult, nameA: string, nameB: string) {
  if (a.score !== b.score) return a.score - b.score
  return nameA.localeCompare(nameB)
}

export type MarginSignal = 'over_budget' | 'watch' | 'on_budget' | 'no_data'

export function burnPct(estimatedHours: number | null, actualHours: number | null) {
  if (!estimatedHours || actualHours == null) return null
  return Math.round((actualHours / estimatedHours) * 100)
}

/** Margin signal from hours burned vs estimate and optional projected contract cost */
export function marginSignal(
  estimatedHours: number | null,
  actualHours: number | null,
  projectedCost: number | null,
  contractValue: number | null,
): MarginSignal {
  const pct = burnPct(estimatedHours, actualHours)
  if (pct == null && projectedCost == null) return 'no_data'
  if (
    (pct != null && pct > 100) ||
    (projectedCost != null && contractValue != null && projectedCost > contractValue)
  ) {
    return 'over_budget'
  }
  if (pct != null && pct > 85) return 'watch'
  return 'on_budget'
}
