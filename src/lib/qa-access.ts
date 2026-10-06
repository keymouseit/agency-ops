export const QA_TEST_CYCLE_VIEW_ROLES = ['Founder', 'Manager', 'QA', 'Both', 'BD'] as const
export const QA_TEST_CYCLE_MANAGE_ROLES = ['QA', 'Founder'] as const
export const QA_TEST_CYCLE_CREATE_ROLES = ['QA'] as const

export function canViewQATestCycles(role?: string | null) {
  return !!role && (QA_TEST_CYCLE_VIEW_ROLES as readonly string[]).includes(role)
}

export function canManageQATestCycles(role?: string | null) {
  return !!role && (QA_TEST_CYCLE_MANAGE_ROLES as readonly string[]).includes(role)
}

export function canCreateQATestCycles(role?: string | null) {
  return !!role && (QA_TEST_CYCLE_CREATE_ROLES as readonly string[]).includes(role)
}

/**
 * QA list visibility:
 * - status === 'qa' (in QA stage), OR
 * - project is assigned to a QA / Both member (or to the current QA user)
 *
 * Does NOT include every active/scoping project.
 */
export function qaDashboardProjectWhere(opts: {
  userId: string
  role?: string | null
}) {
  const privileged = ['Founder', 'Manager', 'BD'].includes(opts.role ?? '')

  if (privileged) {
    return {
      OR: [
        { status: 'qa' as const },
        {
          assignees: {
            some: { member: { role: { in: ['QA', 'Both'] } } },
          },
        },
      ],
    }
  }

  // QA / Both: shared QA queue + personally assigned projects
  return {
    OR: [
      { status: 'qa' as const },
      { assignees: { some: { memberId: opts.userId } } },
    ],
  }
}
