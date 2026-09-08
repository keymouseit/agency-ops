import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { CACHE_TAGS } from '@/lib/cache-tags'

export type ActiveMember = {
  id: string
  name: string
  role: string
  email: string
}

/** Active team members — shared across dashboard, projects, pipeline (60s). */
export function getActiveMembersCached() {
  return unstable_cache(
    async (): Promise<ActiveMember[]> => {
      return prisma.teamMember.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, role: true, email: true },
      })
    },
    ['active-members-v1'],
    { revalidate: 60, tags: [CACHE_TAGS.activeMembers] },
  )()
}
