export type CheckInProject = {
  id: string
  name: string
  developerId: string
  bdMemberId: string | null
  status: string
  assigneeIds?: string[]
}

/**
 * Projects a member can report on during weekly check-in.
 *
 * Eligibility (aligned with daily plan assignment rules in project-assignees):
 * - Dev / default: developerId or ProjectAssignee
 * - QA: same assignment rule, plus any project currently in `qa` status
 *   (QA pipeline). Do NOT treat all `active` projects as QA-eligible —
 *   that falsely inflated "assigned" lists and empty-state copy.
 * - BD: bdMemberId; Both: assigned or BD; Founder/Manager: all
 */
export function checkInProjectsForMember(
  projects: CheckInProject[],
  memberId: string,
  role: string,
): CheckInProject[] {
  const isAssigned = (p: CheckInProject) =>
    p.developerId === memberId || !!p.assigneeIds?.includes(memberId)

  switch (role) {
    case 'QA':
      return projects.filter(p => isAssigned(p) || p.status === 'qa')
    case 'BD':
      return projects.filter(p => p.bdMemberId === memberId)
    case 'Dev':
      return projects.filter(isAssigned)
    case 'Both':
      return projects.filter(p => isAssigned(p) || p.bdMemberId === memberId)
    case 'Founder':
    case 'Manager':
      return projects
    default:
      return projects.filter(isAssigned)
  }
}
