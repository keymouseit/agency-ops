export type QAEventType =
  | 'test_cycle_logged'
  | 'test_cycle_updated'
  | 'test_cycle_deleted'
  | 'test_cycle_case_dev_fix'
  | 'test_cycle_case_retest'
  | 'test_cycle_case_status_updated'
  | 'release_signoff'
  | 'milestone_created'
  | 'milestone_started'
  | 'milestone_ready_for_qa'
  | 'milestone_testing_started'
  | 'milestone_test_case_added'
  | 'milestone_test_case_updated'
  | 'milestone_approved'
  | 'milestone_status_changed'
  | 'milestone_updated'
  | 'milestone_deleted'
  | 'milestone_bug_fixed'

const MILESTONE_STATUS_LABELS: Record<string, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  ready_for_qa: 'In QA',
  testing: 'In testing',
  done: 'QA approved',
}

function milestoneStatusLabel(status: unknown) {
  const key = String(status ?? '')
  return MILESTONE_STATUS_LABELS[key] ?? key.replace(/_/g, ' ')
}

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
    case 'milestone_created':
      return `Created milestone "${metadata.milestoneTitle}"`
    case 'milestone_updated':
      return `Updated milestone "${metadata.milestoneTitle}"`
    case 'milestone_deleted':
      return `Deleted milestone "${metadata.milestoneTitle}"`
    case 'milestone_started':
      return `Started milestone "${metadata.milestoneTitle}"`
    case 'milestone_ready_for_qa':
      return `Sent milestone "${metadata.milestoneTitle}" to QA`
    case 'milestone_testing_started':
      return `Started testing milestone "${metadata.milestoneTitle}"`
    case 'milestone_test_case_added':
      return `Test case added: "${metadata.caseTitle}" (${metadata.milestoneTitle})`
    case 'milestone_test_case_updated': {
      const status = String(metadata.status ?? 'updated')
      return `Test case "${metadata.caseTitle}" marked ${status} (${metadata.milestoneTitle})`
    }
    case 'milestone_approved':
      return `QA approved milestone "${metadata.milestoneTitle}"`
    case 'milestone_status_changed': {
      const from = milestoneStatusLabel(metadata.fromStatus)
      const to = milestoneStatusLabel(metadata.toStatus)
      return `Moved milestone "${metadata.milestoneTitle}" from ${from} → ${to}`
    }
    case 'milestone_bug_fixed':
      return `Developer fixed bug "${metadata.bugTitle}" (${metadata.milestoneTitle})`
    default:
      return null
  }
}
