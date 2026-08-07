export const QA_CYCLE_RESULT_CONFIG = {
  pass:              { label: 'Pass ✓',              cls: 'bg-green-100 text-green-800',  border: 'border-green-200' },
  fail:              { label: 'Fail — blocked',      cls: 'bg-red-100 text-red-800',      border: 'border-red-200' },
  conditional:       { label: 'Conditional',         cls: 'bg-amber-100 text-amber-800',   border: 'border-amber-200' },
  pending:           { label: 'In progress',         cls: 'bg-blue-100 text-blue-800',     border: 'border-blue-100' },
  not_applicable:    { label: 'Not applicable',      cls: 'bg-slate-100 text-slate-700',   border: 'border-slate-200' },
  out_of_scope:      { label: 'Out of scope',        cls: 'bg-purple-100 text-purple-800', border: 'border-purple-200' },
  deferred:          { label: 'Deferred',            cls: 'bg-amber-100 text-amber-800',   border: 'border-amber-200' },
  environment_issue: { label: 'Environment issue', cls: 'bg-sky-100 text-sky-800',       border: 'border-sky-200' },
} as const

export type CycleResult = keyof typeof QA_CYCLE_RESULT_CONFIG

export type SelectableCycleResult =
  | 'pass'
  | 'fail'
  | 'conditional'
  | 'not_applicable'
  | 'out_of_scope'
  | 'deferred'
  | 'environment_issue'

export const CYCLE_RESULT_OPTIONS = [
  { value: 'pass' as const,              label: '✓ Pass — clear to release',        cls: 'border-green-300 bg-green-50 text-green-800' },
  { value: 'conditional' as const,       label: '~ Conditional — minor issues',      cls: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'fail' as const,              label: '⛔ Fail — release blocked',         cls: 'border-red-300 bg-red-50 text-red-800' },
]

export const CYCLE_NON_EXECUTABLE_RESULT_OPTIONS = [
  { value: 'not_applicable' as const,    label: 'Not applicable',      cls: 'border-slate-300 bg-slate-50 text-slate-700' },
  { value: 'out_of_scope' as const,      label: 'Out of scope',        cls: 'border-purple-300 bg-purple-50 text-purple-800' },
  { value: 'deferred' as const,          label: 'Deferred',            cls: 'border-amber-300 bg-amber-50 text-amber-800' },
  { value: 'environment_issue' as const, label: 'Environment issue',   cls: 'border-sky-300 bg-sky-50 text-sky-800' },
]

const NON_EXECUTABLE_CYCLE_RESULTS = new Set(CYCLE_NON_EXECUTABLE_RESULT_OPTIONS.map(o => o.value))

export function isNonExecutableCycleResult(result: string) {
  return NON_EXECUTABLE_CYCLE_RESULTS.has(result as typeof CYCLE_NON_EXECUTABLE_RESULT_OPTIONS[number]['value'])
}

export function cycleSupportsBlockerNote(result: string) {
  return result === 'fail' || result === 'conditional' || isNonExecutableCycleResult(result)
}

export const QA_SEVERITY_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-orange-100 text-orange-800',
  medium:   'bg-amber-100 text-amber-800',
  low:      'bg-gray-100 text-gray-600',
}

export const QA_CHECKLIST_ITEMS = [
  { key: 'testedAuth',          label: 'Authentication & permissions' },
  { key: 'testedCoreFlows',     label: 'Core user flows (happy paths)' },
  { key: 'testedEdgeCases',     label: 'Edge cases & error states' },
  { key: 'testedMobile',        label: 'Mobile / responsive' },
  { key: 'testedCrossBrowser',  label: 'Cross-browser' },
  { key: 'testedPerformance',   label: 'Performance' },
  { key: 'testedIntegrations',  label: '3rd party integrations' },
  { key: 'testedDataIntegrity', label: 'Data integrity & persistence' },
] as const

export const QA_SIGNOFF_CHECKLIST = [
  { key: 'sanityPassed',        label: 'Sanity test passed' },
  { key: 'regressionPassed',    label: 'Regression passed' },
  { key: 'noBlockersOpen',      label: 'No open blockers' },
  { key: 'stagingMatchesLive',  label: 'Staging matches live' },
  { key: 'clientUATDone',       label: 'Client UAT done' },
  { key: 'knownIssuesAgreed',   label: 'Known issues agreed with client' },
] as const

export const TEST_CYCLE_CASE_STATUSES = ['pass', 'fail', 'blocked', 'skipped'] as const

export const TEST_CYCLE_CASE_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pass:    { label: 'Pass',    cls: 'bg-green-100 text-green-800' },
  fail:    { label: 'Fail',    cls: 'bg-red-100 text-red-800' },
  blocked: { label: 'Blocked', cls: 'bg-orange-100 text-orange-800' },
  skipped: { label: 'Skipped', cls: 'bg-gray-100 text-gray-500' },
}

export type SerializedTestCycleCase = {
  id: string
  title: string
  status: string
  notes: string | null
  devFixedAt?: string | null
  devFixNotes?: string | null
  devFixedBy?: { name: string } | null
  qaRetestedAt?: string | null
  qaRetestNotes?: string | null
  qaRetestedBy?: { name: string } | null
}

export function hasFailingTestCases(testCases: { status: string }[]) {
  return testCases.some(tc => tc.status === 'fail' || tc.status === 'blocked')
}

/** Overall cycle result must reflect individual test case outcomes. */
export function deriveCycleResult(
  requestedResult: string,
  testCases: { status: string }[],
): CycleResult {
  if (hasFailingTestCases(testCases)) return 'fail'
  if (isNonExecutableCycleResult(requestedResult)) return requestedResult as CycleResult
  if (requestedResult === 'conditional') return 'conditional'
  if (requestedResult === 'fail') return 'fail'
  return 'pass'
}

export function testCycleCaseSummary(cases: { status: string; devFixedAt?: string | Date | null }[]) {
  const failing = cases.filter(c => c.status === 'fail' || c.status === 'blocked')
  const unfixed = failing.filter(c => !c.devFixedAt)
  const awaitingQARetest = failing.filter(c => c.devFixedAt)
  return {
    total: cases.length,
    failing: failing.length,
    unfixed: unfixed.length,
    awaitingQARetest: awaitingQARetest.length,
    allFailuresFixed: failing.length > 0 && unfixed.length === 0,
    allPassed: cases.length > 0 && !hasFailingTestCases(cases),
  }
}

/** Recompute overall cycle result after case updates on the same cycle. */
export function deriveCycleResultFromCases(
  cases: { status: string }[],
  previousResult: string,
): CycleResult {
  if (hasFailingTestCases(cases)) return 'fail'
  if (isNonExecutableCycleResult(previousResult)) return previousResult as CycleResult
  if (previousResult === 'conditional') return 'conditional'
  return 'pass'
}
