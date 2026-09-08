export type QAEventType =
  | 'test_cycle_logged'
  | 'test_cycle_updated'
  | 'test_cycle_deleted'
  | 'test_cycle_case_dev_fix'
  | 'test_cycle_case_retest'
  | 'test_cycle_case_status_updated'
  | 'release_signoff'
  | 'milestone_ready_for_qa'
  | 'milestone_testing_started'
  | 'milestone_test_case_added'
  | 'milestone_test_case_updated'
  | 'milestone_approved'
  | 'milestone_bug_fixed'

export function formatQAActivitySummary(metadata: Record<string, unknown> | null): string | null {
  if (!metadata?.qaEventType) return null

  switch (metadata.qaEventType as QAEventType) {
    case 'test_cycle_logged': {
      const type = String(metadata.cycleType ?? 'test').replace(/_/g, ' ')
      const env = metadata.environment ? ` on ${metadata.environment}` : ''
      const result = String(metadata.result ?? 'pending')
      const passed = metadata.passedCount
      const total = metadata.totalCases
      const counts = passed != null && total != null ? ` (${passed}/${total} cases passed)` : ''
      return `Test cycle logged: ${type}${env} — ${result}${counts}`
    }
    case 'test_cycle_updated': {
      const type = String(metadata.cycleType ?? 'test').replace(/_/g, ' ')
      const result = String(metadata.result ?? 'pending')
      const passed = metadata.passedCount
      const total = metadata.totalCases
      const counts = passed != null && total != null ? ` (${passed}/${total} cases passed)` : ''
      return `Test cycle updated: ${type} — ${result}${counts}`
    }
    case 'test_cycle_deleted':
      return `Test cycle deleted (${String(metadata.cycleType ?? 'test').replace(/_/g, ' ')}, was ${metadata.result})`
    case 'test_cycle_case_dev_fix':
      return `Developer fixed test case "${metadata.caseTitle}"`
    case 'test_cycle_case_retest': {
      const verdict = metadata.status === 'pass' ? 'verified Pass' : 'reopened — still failing'
      return `QA re-tested "${metadata.caseTitle}" — ${verdict}`
    }
    case 'test_cycle_case_status_updated':
      return `QA updated test case "${metadata.caseTitle}" → ${metadata.status}`
    case 'release_signoff': {
      const score = metadata.qualityScore != null ? ` (quality ${metadata.qualityScore}/10)` : ''
      return `Release sign-off submitted${score}`
    }
    case 'milestone_ready_for_qa':
      return `Milestone sent to QA: "${metadata.milestoneTitle}"`
    case 'milestone_testing_started':
      return `Started testing milestone: "${metadata.milestoneTitle}"`
    case 'milestone_test_case_added':
      return `Test case added: "${metadata.caseTitle}" (${metadata.milestoneTitle})`
    case 'milestone_test_case_updated': {
      const status = String(metadata.status ?? 'updated')
      return `Test case "${metadata.caseTitle}" marked ${status} (${metadata.milestoneTitle})`
    }
    case 'milestone_approved':
      return `Milestone QA approved: "${metadata.milestoneTitle}"`
    case 'milestone_bug_fixed':
      return `Developer fixed bug "${metadata.bugTitle}" (${metadata.milestoneTitle})`
    default:
      return null
  }
}
