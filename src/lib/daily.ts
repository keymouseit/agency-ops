import { prisma } from '@/lib/prisma'

const openLogInclude = {
  member: true,
  tasks: {
    include: { project: { select: { name: true } } },
    orderBy: { priority: 'asc' as const },
  },
}

/** Most recent DailyLog with a morning plan submitted but EOD still open */
export function findOpenDailyLog(memberId: string) {
  return prisma.dailyLog.findFirst({
    where: {
      memberId,
      planSubmittedAt: { not: null },
      eodSubmittedAt: null,
    },
    include: openLogInclude,
    orderBy: { date: 'desc' },
  })
}

export const dailyLogWithTasksInclude = openLogInclude
