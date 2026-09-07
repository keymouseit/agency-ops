export const QA_TEST_CYCLE_VIEW_ROLES = ['Founder', 'Manager', 'QA', 'Both', 'BD'] as const
export const QA_TEST_CYCLE_MANAGE_ROLES = ['QA', 'Founder'] as const

export function canViewQATestCycles(role?: string | null) {
  return !!role && (QA_TEST_CYCLE_VIEW_ROLES as readonly string[]).includes(role)
}

export function canManageQATestCycles(role?: string | null) {
  return !!role && (QA_TEST_CYCLE_MANAGE_ROLES as readonly string[]).includes(role)
}
