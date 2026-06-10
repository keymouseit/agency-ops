import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { startOfDay, subDays, isWeekend } from 'date-fns'
import Link from 'next/link'
import MorningPlanForm from './MorningPlanForm'

export const dynamic = 'force-dynamic'

export default async function MorningPlanPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberId = session.user.id
  const today = startOfDay(new Date())
  const yesterday = startOfDay(subDays(today, 1))

  const [member, projects, todayLog, yesterdayLog] = await Promise.all([
    prisma.teamMember.findUnique({ where: { id: memberId } }),

    prisma.project.findMany({
      where: { status: { in: ['active', 'qa', 'scoping'] } },
      select: { id: true, name: true, clientName: true },
      orderBy: { name: 'asc' },
    }),

    prisma.dailyLog.findUnique({
      where: { memberId_date: { memberId, date: today } },
      select: {
        id: true,
        planSubmittedAt: true,
        eodSubmittedAt: true,
        planNotes: true,
        tasks: {
          select: {
            title: true,
            taskType: true,
            priority: true,
            projectId: true,
            estimatedHours: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),

    // Skip weekend — don't gate on Sat/Sun
    !isWeekend(yesterday)
      ? prisma.dailyLog.findUnique({
        where: { memberId_date: { memberId, date: yesterday } },
        select: { id: true, planSubmittedAt: true, eodSubmittedAt: true },
      })
      : Promise.resolve(null),
  ])

  if (!member) redirect('/login')

  const isEditMode = !!(todayLog?.planSubmittedAt && !todayLog?.eodSubmittedAt)
  const missingYesterdayEOD = !!(yesterdayLog?.planSubmittedAt && !yesterdayLog?.eodSubmittedAt)
  const replanAfterEod = !!(todayLog?.planSubmittedAt && todayLog?.eodSubmittedAt)

  const initialTasks = todayLog?.tasks.map(t => ({
    title: t.title,
    taskType: t.taskType,
    priority: t.priority,
    projectId: t.projectId ?? '',
    estimatedHours: t.estimatedHours?.toString() ?? '',
  }))
  const alreadyPlannedToday = !!todayLog?.planSubmittedAt;

  if (alreadyPlannedToday && !isEditMode) {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="card p-8 text-center">
          <div className="text-2xl mb-4">✅</div>

          <h1 className="text-xl font-semibold mb-2">
            Plan already submitted
          </h1>

          <p className="text-sm text-gray-500">
            You have already submitted your plan for today.
          </p>

          {todayLog?.eodSubmittedAt && (
            <p className="text-sm text-gray-500 mt-2">
              Your EOD is also completed. You can create a new plan tomorrow.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── GATE ─────────────────────────────────────────────────────────────────
  if (missingYesterdayEOD) {
    return (
      <div className="max-w-lg mx-auto py-16">
        <div className="card p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⏰</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Yesterday&apos;s EOD is missing
          </h1>
          <p className="text-sm text-gray-500 mb-1">
            You submitted a plan yesterday but never closed the day.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Submit your EOD first — then you can plan today.
          </p>
          <Link
            href={`/daily/eod?logId=${yesterdayLog?.id}`}
            className="inline-block btn-primary px-6 py-2.5 text-sm"
          >
            Submit yesterday&apos;s EOD →
          </Link>
          <p className="text-xs text-gray-400 mt-6">
            Today&apos;s plan will be available once your EOD is submitted.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MorningPlanForm
      member={{ id: member.id, name: member.name, role: member.role }}
      projects={projects}
      replanAfterEod={replanAfterEod}
      isEdit={isEditMode}
      initialTasks={isEditMode ? initialTasks : undefined}
      initialPlanNotes={isEditMode ? (todayLog?.planNotes ?? '') : undefined}
    />
  )
}
