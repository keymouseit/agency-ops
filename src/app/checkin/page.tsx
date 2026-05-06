import { prisma } from '@/lib/prisma'
import CheckInClient from './CheckInClient'

export const dynamic = 'force-dynamic'

export default async function CheckInPage() {
  const [members, projects] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.project.findMany({
      where: { status: { in: ['scoping', 'active', 'qa'] } },
      select: { id: true, name: true, ownerId: true },
      orderBy: { name: 'asc' },
    }),
  ])
  return <CheckInClient members={members} projects={projects} />
}
