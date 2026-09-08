import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { authorizeRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { businessDayStart } from '@/lib/daily'

export async function POST(req: Request) {
  const authResult = await authorizeRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia'])
  if (authResult instanceof NextResponse) return authResult
  const { memberId } = authResult

  const data = await req.json()

  if (!data.tasks || !Array.isArray(data.tasks) || data.tasks.length === 0) {
    return NextResponse.json({ error: 'Add at least one task.' }, { status: 400 })
  }

  const taskRows = data.tasks.map((t: {
    title: string
    taskType: string
    priority: string
    projectId: string
    estimatedHours: string
  }) => ({
    title: t.title?.trim() ?? '',
    taskType: t.taskType || 'feature',
    priority: t.priority || 'medium',
    projectId: t.projectId || null,
    estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours) : null,
  }))

  if (taskRows.some(t => !t.title)) {
    return NextResponse.json({ error: 'Every task needs a description.' }, { status: 400 })
  }

  if (taskRows.some(t => !t.estimatedHours || t.estimatedHours <= 0)) {
    return NextResponse.json({ error: 'Every task needs estimated hours.' }, { status: 400 })
  }

  const today = businessDayStart()

  const log = await prisma.$transaction(async tx => {
    const existing = await tx.dailyLog.findUnique({
      where: { memberId_date: { memberId, date: today } },
      select: { eodSubmittedAt: true },
    })
    const replanAfterEod = !!data.replanAfterEod && !!existing?.eodSubmittedAt

    const upserted = await tx.dailyLog.upsert({
      where: { memberId_date: { memberId, date: today } },
      update: {
        planSubmittedAt: new Date(),
        planNotes: data.planNotes || null,
        planMissed: false,
        ...(replanAfterEod ? {
          eodSubmittedAt: null,
          blockers: null,
          carryOver: null,
          dayRating: null,
          eodNotes: null,
          completionRate: null,
          estimationScore: null,
          eodMissed: false,
        } : {}),
      },
      create: {
        memberId,
        date: today,
        planSubmittedAt: new Date(),
        planNotes: data.planNotes || null,
      },
    })

    await tx.dailyTask.deleteMany({ where: { dailyLogId: upserted.id } })
    await tx.dailyTask.createMany({
      data: taskRows.map(t => ({
        dailyLogId: upserted.id,
        title: t.title,
        taskType: t.taskType,
        priority: t.priority,
        projectId: t.projectId,
        estimatedHours: t.estimatedHours,
        status: 'planned',
      })),
    })

    return upserted
  })

  revalidatePath('/me')
  revalidatePath('/daily')
  revalidatePath('/daily/plan')
  revalidatePath('/daily/eod')

  return NextResponse.json(log)
}
