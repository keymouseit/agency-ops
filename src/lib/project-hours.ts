import { prisma } from '@/lib/prisma'

type HourTask = {
  projectId?: string | null
  status?: string | null
  actualHours?: number | null
  estimatedHours?: number | null
}

/** Hours that count toward project logged time for one daily task. */
export function taskHoursTowardLogged(task: HourTask): number {
  if (task.status === 'skipped') return 0
  const hours = task.actualHours ?? task.estimatedHours ?? 0
  return Number.isFinite(hours) && hours > 0 ? hours : 0
}

/** Sum logged hours per project from daily tasks (actual if set, else planned). */
export async function getLoggedHoursByProjectIds(
  projectIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const ids = [...new Set(projectIds.filter(Boolean))]
  if (ids.length === 0) return map

  const tasks = await prisma.dailyTask.findMany({
    where: {
      projectId: { in: ids },
      status: { not: 'skipped' },
    },
    select: {
      projectId: true,
      actualHours: true,
      estimatedHours: true,
      status: true,
    },
  })

  for (const task of tasks) {
    if (!task.projectId) continue
    const next = Number(((map.get(task.projectId) ?? 0) + taskHoursTowardLogged(task)).toFixed(2))
    map.set(task.projectId, next)
  }

  return map
}

/**
 * Recalculate and store project.actualHours from daily tasks.
 * Use after morning plan / EOD so list + detail stay in sync.
 */
export async function syncProjectLoggedHours(projectIds: string[]) {
  const ids = [...new Set(projectIds.filter(Boolean))]
  if (ids.length === 0) return

  const hoursMap = await getLoggedHoursByProjectIds(ids)
  await Promise.all(
    ids.map(id =>
      prisma.project.update({
        where: { id },
        data: { actualHours: hoursMap.get(id) ?? 0 },
      })
    )
  )
}
