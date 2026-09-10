import { revalidatePath, revalidateTag } from 'next/cache'

/** Shared Next.js cache tags for short-lived server reads. */
export const CACHE_TAGS = {
  branding: 'company-branding',
  leaveToday: 'leave-today',
  activeMembers: 'active-members',
  projectsList: 'projects-list',
  pipelineLeads: 'pipeline-leads',
} as const

export function invalidateLeaveTodayCache() {
  revalidateTag(CACHE_TAGS.leaveToday)
}

/** Bust leave pages so HR/admin lists update without a manual refresh. */
export function revalidateLeavePages() {
  invalidateLeaveTodayCache()
  revalidatePath('/leaves')
  revalidatePath('/me')
  revalidatePath('/')
}

export function invalidateActiveMembersCache() {
  revalidateTag(CACHE_TAGS.activeMembers)
}

export function invalidateProjectsListCache() {
  revalidateTag(CACHE_TAGS.projectsList)
}

/** Bust list + project/QA detail pages after project mutations. */
export function invalidateProjectCaches(projectId: string) {
  invalidateProjectsListCache()
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/qa/${projectId}`)
}

export function invalidatePipelineLeadsCache() {
  revalidateTag(CACHE_TAGS.pipelineLeads)
}
