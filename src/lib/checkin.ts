export type CheckInProject = {
  id: string
  name: string
  developerId: string
  bdMemberId: string | null
  status: string
}

/** Projects a member can report on during weekly check-in. */
export function checkInProjectsForMember(
  projects: CheckInProject[],
  memberId: string,
  role: string,
): CheckInProject[] {
  switch (role) {
    case 'QA':
      return projects.filter(p => p.status === 'qa' || p.status === 'active')
    case 'BD':
      return projects.filter(p => p.bdMemberId === memberId)
    case 'Dev':
      return projects.filter(p => p.developerId === memberId)
    case 'Both':
      return projects.filter(
        p => p.developerId === memberId || p.bdMemberId === memberId,
      )
    case 'Founder':
    case 'Manager':
      return projects
    default:
      return projects.filter(p => p.developerId === memberId)
  }
}
