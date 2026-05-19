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

  // Serialize dates for client component
  const serializedMembers = members.map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }))

  const serializedGoals = goals.map(g => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    targetDate: g.targetDate?.toISOString() || null,
    member: {
      ...g.member,
      createdAt: g.member.createdAt.toISOString(),
    },
  }))

  return <GoalsClient members={serializedMembers} goals={serializedGoals} />
}
