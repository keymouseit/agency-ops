import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditEod } from '@/lib/daily'

const ALLOWED_TASK_STATUSES = new Set(['done', 'partial', 'blocked', 'moved', 'skipped'])

type TaskUpdatePayload = {
  status: string
  actualHours: string
  eodNotes: string
  blockedReason: string
}

type NewTaskPayload = {
  title: string
  projectId?: string
  actualHours?: string
  eodNotes?: string
  status?: string
}

function projectHourDelta(
  deltas: Map<string, number>,
  projectId: string | null | undefined,
  delta: number,
) {
  if (!projectId || delta === 0) return
  deltas.set(projectId, (deltas.get(projectId) ?? 0) + delta)
}

export async function POST(
  req: Request,
  { params }: { params: { logId: string } }
) {
  const authResult = await authorizeRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia'])
  if (authResult instanceof NextResponse) return authResult
  const { memberId } = authResult

  const existingLog = await prisma.dailyLog.findUnique({
    where: { id: params.logId },
    select: { memberId: true, eodSubmittedAt: true },
  })

  if (!existingLog) {
    return NextResponse.json({ error: 'Daily log not found' }, { status: 404 })
  }

  if (existingLog.memberId !== memberId) {
    return NextResponse.json({ error: 'You can only submit your own EOD' }, { status: 403 })
  }

  if (existingLog.eodSubmittedAt && !canEditEod(existingLog.eodSubmittedAt)) {
    return NextResponse.json(
      { error: 'EOD can only be edited on the day it was submitted' },
      { status: 403 }
    )
  }

  const data = await req.json()
  const taskUpdates = (data.taskUpdates ?? {}) as Record<string, TaskUpdatePayload>
  const newTasksRaw = Array.isArray(data.newTasks) ? (data.newTasks as NewTaskPayload[]) : []

  const newTasks = newTasksRaw
    .map(t => ({
      title: typeof t.title === 'string' ? t.title.trim() : '',
      projectId: typeof t.projectId === 'string' && t.projectId ? t.projectId : null,
      actualHours: t.actualHours ? parseFloat(t.actualHours) : null,
      eodNotes: typeof t.eodNotes === 'string' ? t.eodNotes.trim() || null : null,
      status: ALLOWED_TASK_STATUSES.has(t.status ?? '') ? (t.status as string) : 'done',
    }))
    .filter(t => t.title.length > 0)

  for (const update of Object.values(taskUpdates)) {
    if (!ALLOWED_TASK_STATUSES.has(update.status)) {
      return NextResponse.json({ error: `Invalid task status: ${update.status}` }, { status: 400 })
    }
  }

  const existingTasks = await prisma.dailyTask.findMany({
    where: { dailyLogId: params.logId },
    select: { id: true, projectId: true, actualHours: true, estimatedHours: true, status: true },
  })

  const existingById = new Map(existingTasks.map(task => [task.id, task]))
  const projectDeltas = new Map<string, number>()

  for (const [taskId, update] of Object.entries(taskUpdates)) {
    const prev = existingById.get(taskId)
    if (!prev) continue

    const newHours =
      update.status === 'skipped'
        ? null
        : update.actualHours
          ? parseFloat(update.actualHours)
          : null
    projectHourDelta(projectDeltas, prev.projectId, -(prev.actualHours ?? 0))
    projectHourDelta(projectDeltas, prev.projectId, newHours ?? 0)
  }

  for (const task of newTasks) {
    const hours = task.status === 'skipped' ? null : task.actualHours
    projectHourDelta(projectDeltas, task.projectId, hours ?? 0)
  }

  const log = await prisma.$transaction(async tx => {
    await Promise.all(
      Object.entries(taskUpdates).map(([taskId, update]) => {
        if (!existingById.has(taskId)) return Promise.resolve()
        const isSkipped = update.status === 'skipped'
        return tx.dailyTask.update({
          where: { id: taskId },
          data: {
            status: update.status,
            actualHours: isSkipped
              ? null
              : update.actualHours
                ? parseFloat(update.actualHours)
                : null,
            eodNotes: update.eodNotes || null,
            blockedReason: update.status === 'blocked' ? update.blockedReason || null : null,
          },
        })
      })
    )

    if (newTasks.length > 0) {
      await tx.dailyTask.createMany({
        data: newTasks.map(t => ({
          dailyLogId: params.logId,
          title: t.title,
          projectId: t.projectId,
          taskType: 'feature',
          priority: 'medium',
          estimatedHours: t.actualHours && t.actualHours > 0 ? t.actualHours : null,
          status: t.status,
          actualHours: t.status === 'skipped' ? null : t.actualHours,
          eodNotes: t.eodNotes,
        })),
      })
    }

    const allTasks = await tx.dailyTask.findMany({
      where: { dailyLogId: params.logId },
      select: { status: true, estimatedHours: true, actualHours: true },
    })

    const completionRate = allTasks.length > 0
      ? allTasks.filter(t => t.status === 'done').length / allTasks.length
      : null

    const tasksWithBothHours = allTasks.filter(
      t => t.estimatedHours && t.actualHours && t.estimatedHours > 0 && t.status !== 'skipped'
    )
    const estimationScore = tasksWithBothHours.length > 0
      ? tasksWithBothHours.reduce((sum, t) => sum + (t.actualHours! / t.estimatedHours!), 0) / tasksWithBothHours.length
      : null

    const updatedLog = await tx.dailyLog.update({
      where: { id: params.logId },
      data: {
        eodSubmittedAt: existingLog.eodSubmittedAt ?? new Date(),
        blockers: data.blockers || null,
        carryOver: data.carryOver || null,
        dayRating: data.dayRating ? parseInt(data.dayRating) : null,
        eodNotes: data.eodNotes || null,
        completionRate,
        estimationScore,
      },
    })

    await Promise.all(
      [...projectDeltas.entries()].map(([projectId, delta]) =>
        tx.project.update({
          where: { id: projectId },
          data: { actualHours: { increment: delta } },
        })
      )
    )

    return updatedLog
  })

  revalidatePath('/me')
  revalidatePath('/daily')
  revalidatePath('/daily/plan')
  revalidatePath('/daily/eod')
  revalidatePath('/')

  return NextResponse.json(log)
}
