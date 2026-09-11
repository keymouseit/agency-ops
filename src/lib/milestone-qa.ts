export const MILESTONE_STATUSES = [
  'pending',
  'in_progress',
  'ready_for_qa',
  'testing',
  'done',
] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]

export const TEST_CASE_STATUSES = ['pending', 'pass', 'fail', 'blocked', 'skipped'] as const
export type TestCaseStatus = (typeof TEST_CASE_STATUSES)[number]

export const BUG_STATUSES = ['open', 'fixed', 'closed', 'wont_fix'] as const
export type BugStatus = (typeof BUG_STATUSES)[number]

export const BUG_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const
export type BugSeverity = (typeof BUG_SEVERITIES)[number]

/** Weight toward overall delivery progress (QA approval still = 100% of a milestone). */
export const MILESTONE_PROGRESS_WEIGHT: Record<MilestoneStatus, number> = {
  pending: 0,
  in_progress: 0.5,
  ready_for_qa: 0.75,
  testing: 0.85,
  done: 1,
}

export const MILESTONE_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:       { label: 'Not started',    cls: 'bg-gray-100 text-gray-600' },
  in_progress:   { label: 'In progress',    cls: 'bg-amber-100 text-amber-800' },
  ready_for_qa:  { label: 'In QA',          cls: 'bg-blue-100 text-blue-800' },
  testing:       { label: 'In testing',     cls: 'bg-teal-100 text-teal-800' },
  done:          { label: 'QA approved',    cls: 'bg-green-100 text-green-800' },
}

export function isMilestoneStatus(value: string): value is MilestoneStatus {
  return (MILESTONE_STATUSES as readonly string[]).includes(value)
}

/** Weighted % so started / in-QA work shows progress before QA approval. */
export function calculateMilestoneProgress(milestones: { status: string }[]) {
  const total = milestones.length
  if (total === 0) return 0
  const sum = milestones.reduce((acc, m) => {
    const weight = isMilestoneStatus(m.status)
      ? MILESTONE_PROGRESS_WEIGHT[m.status]
      : 0
    return acc + weight
  }, 0)
  return Math.round((sum / total) * 100)
}

export const TEST_CASE_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending',  cls: 'bg-gray-100 text-gray-600' },
  pass:    { label: 'Pass',     cls: 'bg-green-100 text-green-800' },
  fail:    { label: 'Fail',     cls: 'bg-red-100 text-red-800' },
  blocked: { label: 'Blocked',  cls: 'bg-orange-100 text-orange-800' },
  skipped: { label: 'Skipped',  cls: 'bg-gray-100 text-gray-500' },
}

export const BUG_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open:      { label: 'Open',      cls: 'bg-red-100 text-red-800' },
  fixed:     { label: 'Fixed',     cls: 'bg-green-100 text-green-800' },
  closed:    { label: 'Closed',    cls: 'bg-gray-100 text-gray-600' },
  wont_fix:  { label: "Won't fix", cls: 'bg-amber-100 text-amber-800' },
}

export const BUG_SEVERITY_CONFIG: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-800' },
  high:     { label: 'High',     cls: 'bg-orange-100 text-orange-800' },
  medium:   { label: 'Medium',   cls: 'bg-amber-100 text-amber-800' },
  low:      { label: 'Low',      cls: 'bg-gray-100 text-gray-600' },
}

export type SerializedTestCase = {
  id: string
  title: string
  status: string
  notes: string | null
  testedAt: string | null
  testedBy: { name: string } | null
}

export type SerializedBug = {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  testCaseId: string | null
  reportedAt: string
  reportedBy: { name: string }
  resolvedAt: string | null
  resolutionNotes: string | null
}

export function testCaseSummary(testCases: { status: string }[]) {
  const total = testCases.length
  const completed = testCases.filter(t => t.status === 'pass' || t.status === 'skipped').length
  const failed = testCases.filter(t => t.status === 'fail').length
  const blocked = testCases.filter(t => t.status === 'blocked').length
  const pending = testCases.filter(t => t.status === 'pending').length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return { total, completed, failed, blocked, pending, passed: completed, pct }
}

/** True when every test case is pass or skipped (and at least one exists). */
export function allTestCasesPassed(testCases: { status: string }[]) {
  if (testCases.length === 0) return false
  return testCases.every(t => t.status === 'pass' || t.status === 'skipped')
}

export function milestoneHasTestingVisibility(
  status: string,
  testCaseCount: number,
  bugCount = 0,
) {
  return status === 'testing' || status === 'done'
    || (status === 'ready_for_qa' && (testCaseCount > 0 || bugCount > 0))
}

export function openBugCount(bugs: { status: string }[]) {
  return bugs.filter(b => b.status === 'open').length
}
