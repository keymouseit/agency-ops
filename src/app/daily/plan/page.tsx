import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  businessDayStart,
  findPendingPastEodLogSummary,
  formatDailyLogDate,
  findCarryOverMovedTasks,
  carryOverTasksToPlanRows,
} from '@/lib/daily'
import { listDailyProjectsForMember } from '@/lib/project-assignees'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MorningPlanForm from './MorningPlanForm'
import { getExpectedHours } from '@/lib/expected-hours'
import { getPlanLeaveBlock } from '@/lib/leave-plan-block'

export const dynamic = 'force-dynamic'

export default async function MorningPlanPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberId = session.user.id
  const today = businessDayStart()

  const [member, todayLog, pendingPastEodLog, carryOverMoved, expectedToday, leaveBlock] = await Promise.all([
    prisma.teamMember.findUnique({ where: { id: memberId } }),

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

    findPendingPastEodLogSummary(memberId),

    findCarryOverMovedTasks(memberId),

    getExpectedHours(memberId, today),

    getPlanLeaveBlock(memberId, today),
  ])

  const projects = await listDailyProjectsForMember(
    memberId,
    [
      ...(todayLog?.tasks.map(t => t.projectId ?? '') ?? []),
      ...(carryOverMoved?.tasks.map(t => t.projectId ?? '') ?? []),
    ],
    member?.role ?? session.user.role,
  )

  const milestones = projects.length
    ? await prisma.milestone.findMany({
        where: {
          projectId: { in: projects.map(p => p.id) },
        },
        select: { id: true, title: true, projectId: true, status: true },
        orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
      })
    : []

  if (!member) redirect('/login')

  const isEditMode = !!(todayLog?.planSubmittedAt && !todayLog?.eodSubmittedAt)
  const missingPastEOD = !!pendingPastEodLog
  const replanAfterEod = !!(todayLog?.planSubmittedAt && todayLog?.eodSubmittedAt)

  const initialTasks = todayLog?.tasks.map(t => {
    const matchedMilestone = t.projectId
      ? milestones.find(m => m.projectId === t.projectId && m.title === t.title)
      : undefined
    return {
      title: t.title,
      taskType: t.taskType,
      priority: t.priority,
      projectId: t.projectId ?? '',
      milestoneId: matchedMilestone?.id ?? '',
      estimatedHours: t.estimatedHours?.toString() ?? '',
    }
  })
  const alreadyPlannedToday = !!todayLog?.planSubmittedAt

  const carryInTasks =
    !isEditMode &&
    !replanAfterEod &&
    carryOverMoved &&
    !carryOverMoved.sameDay &&
    carryOverMoved.tasks.length > 0
      ? carryOverTasksToPlanRows(carryOverMoved.tasks)
      : undefined

  if (leaveBlock) {
    const existingCount = todayLog?.tasks.length ?? 0
    return (
      <div className="py-8">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white via-white to-amber-50/60 p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl shadow-sm">
            🌴
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">You&apos;re on approved leave today</h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            {leaveBlock.label} on {leaveBlock.dateLabel}. Daily Plan tasks can&apos;t be added on an approved leave day.
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-2">
            If you need to work today, ask management to cancel your leave first. Once it&apos;s cancelled you can
            plan as usual.
          </p>
          {existingCount > 0 && (
            <p className="text-xs text-gray-400 max-w-md mx-auto mt-4">
              The {existingCount} task{existingCount === 1 ? '' : 's'} you planned before the leave was approved
              {existingCount === 1 ? ' is' : ' are'} kept. You can still close {existingCount === 1 ? 'it' : 'them'} out in
              your EOD, but you can&apos;t add or re-plan tasks while the leave stands.
            </p>
          )}
          <div className="flex gap-3 justify-center flex-wrap mt-6">
            <Link href="/leaves" className="btn-secondary text-sm">
              View my leave
            </Link>
            <Link href="/daily" className="btn-secondary text-sm">
              ← Back to daily log
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (alreadyPlannedToday && !isEditMode) {
    return (
      <div className="py-8">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-green-50/40 p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-2xl text-white shadow-sm">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Plan already submitted</h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            You have already submitted your plan for today.
          </p>
          {todayLog?.eodSubmittedAt && (
            <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
              Your EOD is also completed. You can create a new plan tomorrow.
            </p>
          )}
          <Link href="/daily" className="btn-secondary inline-flex mt-6 text-sm">
            ← Back to daily log
          </Link>
        </div>
      </div>
    )
  }

  if (missingPastEOD) {
    const pendingDateLabel = formatDailyLogDate(pendingPastEodLog.date)
    return (
      <div className="py-8">
        <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-white via-white to-red-50/40 p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-2xl shadow-sm">
            ⏰
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Previous EOD is missing</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-1">
            You submitted a plan on {pendingDateLabel} but never closed the day.
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
            Submit that EOD first — then you can plan today.
          </p>
          <Link
            href={`/daily/eod?logId=${pendingPastEodLog.id}`}
            className="btn-primary inline-flex text-sm"
          >
            Submit {formatDailyLogDate(pendingPastEodLog.date)}&apos;s EOD →
          </Link>
          <p className="text-xs text-gray-400 mt-6">
            Today&apos;s plan will be available once your pending EOD is submitted.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MorningPlanForm
      member={{ id: member.id, name: member.name, role: member.role }}
      projects={projects}
      milestones={milestones}
      replanAfterEod={replanAfterEod}
      isEdit={isEditMode}
      initialTasks={isEditMode ? initialTasks : carryInTasks}
      initialPlanNotes={
        isEditMode
          ? (todayLog?.planNotes ?? '')
          : carryOverMoved && !carryOverMoved.sameDay
            ? (carryOverMoved.carryOverNotes ?? '')
            : undefined
      }
      carryOverFromDate={
        carryInTasks?.length && carryOverMoved
          ? formatDailyLogDate(carryOverMoved.sourceDate)
          : undefined
      }
      dayTarget={expectedToday.expectedHours}
      leaveHint={expectedToday.leaveHint}
    />
  )
}
