/** Presentation helpers for Individual (CEO) report — no scoring formula changes. */

export const CEO = {
  green: '#16a34a',
  greenBg: '#dcfce7',
  amber: '#b45309',
  amberBg: '#fef3c7',
  red: '#b91c1c',
  redBg: '#fee2e2',
  blue: '#2563eb',
} as const

export function scoreTone(score: number | null | undefined): 'green' | 'amber' | 'red' {
  if (score == null) return 'amber'
  if (score >= 85) return 'green'
  if (score >= 70) return 'amber'
  return 'red'
}

export function scoreColors(score: number | null | undefined) {
  const t = scoreTone(score)
  if (t === 'green') return { fg: CEO.green, bg: CEO.greenBg, label: 'Strong' as const }
  if (t === 'amber') return { fg: CEO.amber, bg: CEO.amberBg, label: 'Okay' as const }
  return { fg: CEO.red, bg: CEO.redBg, label: 'Needs help' as const }
}

/** Hours target % colour: >=95 green, 80–94 amber, <80 red */
export function hoursTone(pct: number | null | undefined): 'green' | 'amber' | 'red' {
  if (pct == null) return 'amber'
  if (pct >= 95) return 'green'
  if (pct >= 80) return 'amber'
  return 'red'
}

export function hoursColors(pct: number | null | undefined) {
  const t = hoursTone(pct)
  if (t === 'green') return { fg: CEO.green, bg: CEO.greenBg }
  if (t === 'amber') return { fg: CEO.amber, bg: CEO.amberBg }
  return { fg: CEO.red, bg: CEO.redBg }
}

export type TrendKind = 'up' | 'steady' | 'down'

/** First-half vs second-half week scores; ±3 pts = up/down. */
export function trendFromWeekScores(scores: number[]): { kind: TrendKind; label: string; delta: number } {
  if (scores.length < 2) return { kind: 'steady', label: 'Steady', delta: 0 }
  const mid = Math.floor(scores.length / 2)
  const first = scores.slice(0, mid)
  const second = scores.slice(mid)
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const delta = Math.round(avg(second) - avg(first))
  if (delta >= 3) return { kind: 'up', label: 'Trending up', delta }
  if (delta <= -3) return { kind: 'down', label: 'Trending down', delta }
  return { kind: 'steady', label: 'Steady', delta }
}

export function buildVerdict(opts: {
  score: number
  findings: string[]
}): string {
  const problems = opts.findings.filter(
    f =>
      !f.toLowerCase().startsWith('hours on track') &&
      !f.toLowerCase().startsWith('strong self') &&
      !f.toLowerCase().startsWith('no major'),
  )
  const positives = opts.findings.filter(
    f =>
      f.toLowerCase().startsWith('hours on track') ||
      f.toLowerCase().startsWith('strong self') ||
      f.toLowerCase().startsWith('no major'),
  )
  const topProblems = problems.slice(0, 2)
  const parts: string[] = []
  if (topProblems.length) parts.push(topProblems.join(' '))
  if (opts.score >= 85 && positives[0]) parts.push(positives[0])
  if (parts.length === 0) {
    if (opts.score >= 85) return 'Solid period — keep the cadence.'
    if (opts.score >= 70) return 'Mixed period — a few gaps to tighten.'
    return 'Needs attention — focus on the gaps below.'
  }
  return parts.join(' ')
}

export type WorstProjectTag = {
  label: string
  tone: 'red' | 'amber'
} | null

export function worstProjectTag(p: {
  missedDeadline: { detail: string } | null
  milestones: { chip: string }[]
  blockers?: { status: string }[]
}): WorstProjectTag {
  if (p.missedDeadline) return { label: 'Deadline missed', tone: 'red' }
  const delayed = p.milestones.filter(m => m.chip === 'delayed').length
  if (delayed > 0) return { label: delayed === 1 ? 'Delayed' : `${delayed} delayed`, tone: 'red' }
  const needs = p.milestones.filter(m => m.chip === 'needs_attention').length
  if (needs > 0) {
    return { label: needs === 1 ? 'Needs attention' : `${needs} need attention`, tone: 'amber' }
  }
  const openBlockers = (p.blockers ?? []).filter(b => b.status === 'open' || b.status === 'in_progress')
  if (openBlockers.length > 0) {
    return {
      label: openBlockers.length === 1 ? 'Blocked' : `${openBlockers.length} blockers`,
      tone: 'red',
    }
  }
  return null
}
