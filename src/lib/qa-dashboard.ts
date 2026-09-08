import { testCaseSummary } from '@/lib/milestone-qa'
import { testCycleCaseSummary } from '@/lib/qa'

type MilestoneRow = {
  status: string
  testCases?: { status: string }[]
}

type CycleRow = {
  result: string
  cases?: { status: string; devFixedAt?: string | null }[]
}

export function projectMilestoneProgress(milestones: MilestoneRow[]) {
  const total = milestones.length
  const approved = milestones.filter(m => m.status === 'done').length
  const testing = milestones.filter(m => m.status === 'testing').length
  const ready = milestones.filter(m => m.status === 'ready_for_qa').length

  let totalCases = 0
  let passedCases = 0
  let failedCases = 0
  let blockedCases = 0
  for (const m of milestones) {
    const summary = testCaseSummary(m.testCases ?? [])
    totalCases += summary.total
    passedCases += summary.completed
    failedCases += summary.failed
    blockedCases += summary.blocked
  }

  return {
    total,
    approved,
    testing,
    ready,
    totalCases,
    passedCases,
    failedCases,
    blockedCases,
    pct: total > 0 ? Math.round((approved / total) * 100) : 0,
  }
}

/** Progress shown on project list cards — prefer weekly check-in %, else milestones. */
export function projectListCardProgress(
  milestones: MilestoneRow[],
  checkIn?: { progressPct?: number | null } | null,
) {
  const milestone = projectMilestoneProgress(milestones)
  const checkInPct =
    checkIn != null && checkIn.progressPct != null && !Number.isNaN(Number(checkIn.progressPct))
      ? Math.max(0, Math.min(100, Number(checkIn.progressPct)))
      : null

  // Use the better signal so bars don't stick at 0% when check-in lags milestones (or vice versa)
  const pct =
    checkInPct != null
      ? Math.max(checkInPct, milestone.pct)
      : milestone.pct

  const usesCheckIn = checkInPct != null

  return {
    pct,
    milestone,
    usesCheckIn,
    detailLabel:
      milestone.total > 0
        ? `${milestone.approved}/${milestone.total} milestones`
        : usesCheckIn
          ? 'from weekly check-in'
          : null,
  }
}

export function latestCycleProgress(cycle: CycleRow | undefined) {
  if (!cycle?.cases?.length) return null
  const summary = testCycleCaseSummary(cycle.cases)
  const passed = cycle.cases.filter(c => c.status === 'pass' || c.status === 'skipped').length
  return {
    result: cycle.result,
    passed,
    total: cycle.cases.length,
    failing: summary.failing,
    failed: summary.failed,
    blocked: summary.blocked,
    awaitingRetest: summary.awaitingQARetest,
  }
}
