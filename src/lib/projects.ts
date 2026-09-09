type ProjectAssignment = {
  developerId: string
  bdMemberId?: string | null
  assigneeIds?: string[]
}

export function isProjectAdmin(role?: string | null): boolean {
  return !!role && ['Founder', 'Manager'].includes(role)
}

export function canEditProject(
  project: ProjectAssignment,
  userId?: string | null,
  userRole?: string | null,
): boolean {
  if (!userId) return false
  if (isProjectAdmin(userRole)) return true
  if (project.developerId === userId) return true
  if (project.assigneeIds?.includes(userId)) return true
  if (project.bdMemberId === userId) return true
  return false
}

export function canDeleteProject(userRole?: string | null): boolean {
  return isProjectAdmin(userRole)
}

export type ProjectEditField =
  | 'name'
  | 'leadId'
  | 'developerId'
  | 'bdMemberId'
  | 'clientName'
  | 'contractValue'
  | 'currency'
  | 'estimatedHours'
  | 'techStack'
  | 'startDate'
  | 'estimatedEnd'
  | 'actualHours'

export function projectEditFields(
  project: ProjectAssignment,
  userId?: string | null,
  userRole?: string | null,
): Set<ProjectEditField> {
  const fields = new Set<ProjectEditField>()
  if (!canEditProject(project, userId, userRole)) return fields

  if (isProjectAdmin(userRole)) {
    ;[
      'name',
      'leadId',
      'developerId',
      'bdMemberId',
      'clientName',
      'contractValue',
      'currency',
      'estimatedHours',
      'techStack',
      'startDate',
      'estimatedEnd',
      'actualHours',
    ].forEach(f => fields.add(f as ProjectEditField))
    return fields
  }

  fields.add('name')
  fields.add('clientName')

  if (project.developerId === userId || project.assigneeIds?.includes(userId)) {
    ;['techStack', 'estimatedHours', 'actualHours', 'startDate', 'estimatedEnd'].forEach(f =>
      fields.add(f as ProjectEditField),
    )
  }

  if (project.bdMemberId === userId) {
    ;['contractValue', 'currency', 'startDate', 'estimatedEnd'].forEach(f =>
      fields.add(f as ProjectEditField),
    )
  }

  return fields
}
