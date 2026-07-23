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
  for (const m of milestones) {
    const summary = testCaseSummary(m.testCases ?? [])
    totalCases += summary.total
    passedCases += summary.completed
    failedCases += summary.failed
  }

  return {
    total,
    approved,
    testing,
    ready,
    totalCases,
    passedCases,
    failedCases,
    pct: total > 0 ? Math.round((approved / total) * 100) : 0,
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
    awaitingRetest: summary.awaitingQARetest,
  }
}
