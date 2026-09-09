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
