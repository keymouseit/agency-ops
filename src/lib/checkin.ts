export type CheckInProject = {
  id: string
  name: string
  developerId: string
  bdMemberId: string | null
  status: string
  assigneeIds?: string[]
}

/** Projects a member can report on during weekly check-in. */
export function checkInProjectsForMember(
  projects: CheckInProject[],
  memberId: string,
  role: string,
): CheckInProject[] {
  const isAssigned = (p: CheckInProject) =>
    p.developerId === memberId || !!p.assigneeIds?.includes(memberId)

  switch (role) {
    case 'QA':
      return projects.filter(p => p.status === 'qa' || p.status === 'active')
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
