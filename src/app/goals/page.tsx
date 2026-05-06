import { prisma } from '@/lib/prisma'
import GoalsClient from './GoalsClient'
export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const [members, goals] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.goal.findMany({
      include: { member: true },
      orderBy: [{ quarter: 'desc' }, { memberId: 'asc' }],
    }),
  ])
  return <GoalsClient members={members} goals={goals} />
}
