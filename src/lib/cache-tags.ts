import { revalidateTag } from 'next/cache'

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

export function invalidateActiveMembersCache() {
  revalidateTag(CACHE_TAGS.activeMembers)
}

export function invalidateProjectsListCache() {
  revalidateTag(CACHE_TAGS.projectsList)
}

export function invalidatePipelineLeadsCache() {
  revalidateTag(CACHE_TAGS.pipelineLeads)
}
