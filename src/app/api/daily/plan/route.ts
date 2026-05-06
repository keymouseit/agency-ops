import { NextResponse } from 'next/server'
import { checkRole } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfDay } from 'date-fns'

export async function POST(req: Request) {
  const deny = await checkRole(['Dev', 'BD', 'QA', 'Both', 'Founder'])
  if (deny) return deny

  const data = await req.json()
  const today = startOfDay(new Date())

  const log = await prisma.dailyLog.upsert({
    where: { memberId_date: { memberId: data.memberId, date: today } },
    update: {
      planSubmittedAt: new Date(),
      planNotes: data.planNotes || null,
      planMissed: false,
    },
    create: {
      memberId: data.memberId,
      date: today,
      planSubmittedAt: new Date(),
      planNotes: data.planNotes || null,
    },
  })

  // Delete any existing tasks for today (re-plan scenario)
  await prisma.dailyTask.deleteMany({ where: { dailyLogId: log.id } })

  // Create all tasks
  if (data.tasks && Array.isArray(data.tasks)) {
    await prisma.dailyTask.createMany({
      data: data.tasks.map((t: {
        title: string
        taskType: string
        priority: string
        projectId: string
        estimatedHours: string
      }) => ({
        dailyLogId: log.id,
        title: t.title,
        taskType: t.taskType || 'feature',
        priority: t.priority || 'medium',
        projectId: t.projectId || null,
        estimatedHours: t.estimatedHours ? parseFloat(t.estimatedHours) : null,
        status: 'planned',
      })),
    })
  }

  return NextResponse.json(log)
}
