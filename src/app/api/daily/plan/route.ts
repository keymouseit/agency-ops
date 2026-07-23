import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { checkRole, auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay } from 'date-fns'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder', 'HR', 'SocialMedia'])
  if (deny) return deny

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'You must be logged in to submit a plan.' }, { status: 401 })
  }

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

  const memberId = session.user.id
  const today = startOfDay(new Date())

  const existing = await prisma.dailyLog.findUnique({
    where: { memberId_date: { memberId, date: today } },
    select: { eodSubmittedAt: true },
  })
  const replanAfterEod = !!data.replanAfterEod && !!existing?.eodSubmittedAt

  const log = await prisma.dailyLog.upsert({
    where: { memberId_date: { memberId, date: today } },
    update: {
      planSubmittedAt: new Date(),
      planNotes: data.planNotes || null,
      planMissed: false,
      // Only reset EOD when starting a fresh cycle after EOD — not when editing
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

  // Delete any existing tasks for today (re-plan scenario)
  await prisma.dailyTask.deleteMany({ where: { dailyLogId: log.id } })

  // Create all tasks
  await prisma.dailyTask.createMany({
    data: taskRows.map(t => ({
      dailyLogId: log.id,
      title: t.title,
      taskType: t.taskType,
      priority: t.priority,
      projectId: t.projectId,
      estimatedHours: t.estimatedHours,
      status: 'planned',
    })),
  })

  revalidatePath('/daily')
  revalidatePath('/me')
  revalidatePath('/daily/plan')

  return NextResponse.json(log)
}
