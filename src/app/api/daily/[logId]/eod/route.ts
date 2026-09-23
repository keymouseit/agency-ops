import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canEditEod } from '@/lib/daily'
import { syncProjectLoggedHours } from '@/lib/project-hours'
import { invalidateProjectsListCache } from '@/lib/cache-tags'
import { parseHoursInput, parseRequiredPositiveHours } from '@/lib/validation'

const ALLOWED_TASK_STATUSES = new Set(['done', 'partial', 'blocked', 'moved', 'skipped'])

type TaskUpdatePayload = {
  status: string
  actualHours: string
  eodNotes: string
  blockedReason: string
  bdActivity?: unknown
}

function serializeBdActivity(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const rows = raw
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      
      // Support manual BD activity row format
      if (row.channel || row.personName) {
        return {
          id: typeof row.id === 'string' ? row.id : Math.random().toString(36).slice(2),
          personName: typeof row.personName === 'string' ? row.personName.trim() : 'Unknown',
          channel: row.channel === 'Email' || row.channel === 'WhatsApp' ? row.channel : 'LinkedIn',
          newOutreach: Math.max(0, Math.floor(Number(row.newOutreach) || 0)),
          followUps: Math.max(0, Math.floor(Number(row.followUps) || 0)),
          replies: Math.max(0, Math.floor(Number(row.replies) || 0)),
          meetingsBooked: Math.max(0, Math.floor(Number(row.meetingsBooked) || 0)),
        }
      }

      // Legacy support for SalesRobot linkedin format
      const linkedinAccountId =
        typeof row.linkedinAccountId === 'string' ? row.linkedinAccountId.trim() : ''
      if (!linkedinAccountId) return null
      return {
        linkedinAccountId,
        accountName:
          typeof row.accountName === 'string' && row.accountName.trim()
            ? row.accountName.trim()
            : linkedinAccountId,
        newOutreach: Math.max(0, Math.floor(Number(row.newOutreach) || 0)),
        followUps: Math.max(0, Math.floor(Number(row.followUps) || 0)),
        replies: Math.max(0, Math.floor(Number(row.replies) || 0)),
        meetingsBooked: Math.max(0, Math.floor(Number(row.meetingsBooked) || 0)),
        source: row.source === 'manual' ? 'manual' : 'salesrobot',
      }
    })
    .filter(Boolean)
  return rows.length ? JSON.stringify(rows) : null
}

type NewTaskPayload = {
  title: string
  projectId?: string
  actualHours?: string
  eodNotes?: string
  status?: string
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

  const newTasks: Array<{
    title: string
    projectId: string | null
    actualHours: number | null
    eodNotes: string | null
    status: string
  }> = []

  for (const t of newTasksRaw) {
    const title = typeof t.title === 'string' ? t.title.trim() : ''
    if (!title) continue
    const hours = parseRequiredPositiveHours(t.actualHours, 'Actual hours')
    if (!hours.ok) {
      return NextResponse.json({ error: hours.error }, { status: 400 })
    }
    newTasks.push({
      title,
      projectId: typeof t.projectId === 'string' && t.projectId ? t.projectId : null,
      actualHours: hours.value,
      eodNotes: typeof t.eodNotes === 'string' ? t.eodNotes.trim() || null : null,
      status: ALLOWED_TASK_STATUSES.has(t.status ?? '') ? (t.status as string) : 'done',
    })
  }

  const parsedActualHours = new Map<string, number | null>()
  for (const [taskId, update] of Object.entries(taskUpdates)) {
    if (!ALLOWED_TASK_STATUSES.has(update.status)) {
      return NextResponse.json({ error: `Invalid task status: ${update.status}` }, { status: 400 })
    }
    if (update.status === 'skipped') {
      parsedActualHours.set(taskId, null)
      continue
    }
    const hours = parseHoursInput(update.actualHours, { label: 'Actual hours', minExclusive: 0 })
    if (!hours.ok) {
      return NextResponse.json({ error: hours.error }, { status: 400 })
    }
    parsedActualHours.set(taskId, hours.value)
  }

  const existingTasks = await prisma.dailyTask.findMany({
    where: { dailyLogId: params.logId },
    select: { id: true, projectId: true, actualHours: true, estimatedHours: true, status: true },
  })

  const existingById = new Map(existingTasks.map(task => [task.id, task]))
  const linkedProjectIds = [
    ...new Set(
      [
        ...existingTasks.map(t => t.projectId),
        ...newTasks.map(t => t.projectId),
      ].filter((id): id is string => !!id)
    ),
  ]

  const log = await prisma.$transaction(async tx => {
    await Promise.all(
      Object.entries(taskUpdates).map(([taskId, update]) => {
        if (!existingById.has(taskId)) return Promise.resolve()
        const isSkipped = update.status === 'skipped'
        return tx.dailyTask.update({
          where: { id: taskId },
          data: {
            status: update.status,
            actualHours: parsedActualHours.get(taskId) ?? null,
            eodNotes: update.eodNotes || null,
            blockedReason: update.status === 'blocked' ? update.blockedReason || null : null,
            bdActivityJson: isSkipped ? null : serializeBdActivity(update.bdActivity),
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
      ? tasksWithBothHours.reduce((sum, t) => sum + (t.actualHours! / t.estimatedHours!), 0) /
        tasksWithBothHours.length
      : null

    return tx.dailyLog.update({
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
  })

  if (linkedProjectIds.length > 0) {
    await syncProjectLoggedHours(linkedProjectIds)
    invalidateProjectsListCache()
  }

  revalidatePath('/me')
  revalidatePath('/daily')
  revalidatePath('/daily/plan')
  revalidatePath('/daily/eod')
  revalidatePath('/')
  for (const projectId of linkedProjectIds) {
    revalidatePath(`/projects/${projectId}`)
  }

  return NextResponse.json(log)
}
