import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: { logId: string } }
) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()

  const taskUpdates = data.taskUpdates as Record<string, {
    status: string
    actualHours: string
    eodNotes: string
    blockedReason: string
  }>

  // Update each task
  await Promise.all(
    Object.entries(taskUpdates).map(([taskId, update]) =>
      prisma.dailyTask.update({
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

  // Compute completion rate and estimation score for the log
  const tasks = await prisma.dailyTask.findMany({
    where: { dailyLogId: params.logId },
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

  // Update the log with EOD data
  const log = await prisma.dailyLog.update({
    where: { id: params.logId },
    data: {
      eodSubmittedAt: new Date(),
      blockers:        data.blockers  || null,
      carryOver:       data.carryOver || null,
      dayRating:       data.dayRating ? parseInt(data.dayRating) : null,
      eodNotes:        data.eodNotes  || null,
      completionRate,
      estimationScore,
    },
  })

  // ── BLOCKER 3 FIX: Sync project.actualHours from all daily task logs ──────
  // Find every project touched in this log that has actual hours logged
  const projectIds = [...new Set(
    tasks
      .filter(t => t.projectId && t.actualHours !== null && t.actualHours !== undefined)
      .map(t => t.projectId as string)
  )]

  if (projectIds.length > 0) {
    try {
      await Promise.all(
        projectIds.map(async (projectId) => {
          // Sum ALL actual hours ever logged against this project across all daily tasks
          const agg = await prisma.dailyTask.aggregate({
            where: {
              projectId,
              actualHours: { not: null }
            },
            _sum: { actualHours: true },
          })

          const totalHours = agg._sum.actualHours ?? 0

          await prisma.project.update({
            where: { id: projectId },
            data: { actualHours: totalHours },
          })
        })
      )
    } catch (error) {
      console.error('Error syncing project actual hours:', error)
      // Continue anyway - don't fail the EOD submission
    }
  }

  return NextResponse.json(log)
}

