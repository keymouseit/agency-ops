import { prisma } from '@/lib/prisma'

export function uniqueMemberIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return [...new Set(ids.filter((id): id is string => typeof id === 'string' && !!id.trim()))]
}

export function assignedToMemberWhere(memberId: string) {
  return {
    OR: [{ developerId: memberId }, { assignees: { some: { memberId } } }],
  }
}

const DAILY_PROJECT_STATUSES = ['active', 'qa', 'scoping', 'maintenance'] as const

export async function listDailyProjectsForMember(memberId: string, includeIds: string[] = []) {
  const extraIds = [...new Set(includeIds.filter(Boolean))]
  return prisma.project.findMany({
    where: {
      status: { in: [...DAILY_PROJECT_STATUSES] },
      OR: [
        { developerId: memberId },
        { assignees: { some: { memberId } } },
        ...(extraIds.length ? [{ id: { in: extraIds } }] : []),
      ],
    },
    select: { id: true, name: true, clientName: true },
    orderBy: { name: 'asc' },
  })
}

export async function replaceProjectAssignees(projectId: string, memberIds: string[]) {
  const ids = uniqueMemberIds(memberIds)
  await prisma.$transaction([
    prisma.projectAssignee.deleteMany({ where: { projectId } }),
    ...(ids.length
      ? [
          prisma.projectAssignee.createMany({
            data: ids.map(memberId => ({ projectId, memberId })),
          }),
        ]
      : []),
  ])
  return ids
}
