import { NextResponse } from 'next/server'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditEod } from '@/lib/daily'

type TaskUpdatePayload = {
  status: string
  actualHours: string
  eodNotes: string
  blockedReason: string
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
  const taskUpdates = data.taskUpdates as Record<string, TaskUpdatePayload>

  const existingTasks = await prisma.dailyTask.findMany({
    where: { dailyLogId: params.logId },
    select: { id: true, projectId: true, actualHours: true, estimatedHours: true, status: true },
  })

  const existingById = new Map(existingTasks.map(task => [task.id, task]))
  const projectDeltas = new Map<string, number>()

  for (const [taskId, update] of Object.entries(taskUpdates)) {
    const prev = existingById.get(taskId)
    if (!prev) continue

    const newHours = update.actualHours ? parseFloat(update.actualHours) : null
    projectHourDelta(projectDeltas, prev.projectId, -(prev.actualHours ?? 0))
    projectHourDelta(projectDeltas, prev.projectId, newHours ?? 0)
  }

  const log = await prisma.$transaction(async tx => {
    await Promise.all(
      Object.entries(taskUpdates).map(([taskId, update]) =>
        tx.dailyTask.update({
          where: { id: taskId },
          data: {
            status: update.status,
            actualHours: update.actualHours ? parseFloat(update.actualHours) : null,
            eodNotes: update.eodNotes || null,
            blockedReason: update.blockedReason || null,
          },
        })
      )
    )

    const tasks = existingTasks.map(task => {
      const update = taskUpdates[task.id]
      if (!update) return task
      return {
        ...task,
        status: update.status,
        actualHours: update.actualHours ? parseFloat(update.actualHours) : null,
      }
    })

    const completionRate = tasks.length > 0
      ? tasks.filter(t => t.status === 'done').length / tasks.length
      : null

    const tasksWithBothHours = tasks.filter(
      t => t.estimatedHours && t.actualHours && t.estimatedHours > 0
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

  return NextResponse.json(log)
}
