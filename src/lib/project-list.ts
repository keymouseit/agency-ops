import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS } from '@/lib/cache-tags'

const projectListSelect = {
  id: true,
  name: true,
  status: true,
  contractValue: true,
  currency: true,
  estimatedEnd: true,
  actualHours: true,
  estimatedHours: true,
  onTime: true,
  clientScore: true,
  developerId: true,
  developer: { select: { name: true } },
  bdMember: { select: { name: true } },
  checkIns: {
    orderBy: { weekOf: 'desc' as const },
    take: 1,
    select: { onTrack: true, blockers: true, progressPct: true },
  },
  scopeChanges: { select: { changeOrderSigned: true } },
  milestones: { select: { status: true } },
  releaseSignOff: { select: { id: true } },
} as const

export type ProjectListItem = Awaited<ReturnType<typeof fetchProjectList>>[number]

async function fetchProjectList(developerId?: string) {
  return prisma.project.findMany({
    where: developerId ? { developerId } : undefined,
    select: projectListSelect,
    orderBy: { createdAt: 'desc' },
  })
}

/** Project list for /projects — 30s cache, scoped by developer when needed. */
export function getProjectListCached(developerId?: string) {
  const scope = developerId ?? 'all'
  return unstable_cache(
    () => fetchProjectList(developerId),
    ['projects-list-v2', scope],
    { revalidate: 30, tags: [CACHE_TAGS.projectsList] },
  )()
}
