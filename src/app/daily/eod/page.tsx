import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  dailyLogWithTasksInclude,
  findOpenDailyLog,
  findTodayEditableEodLog,
  isEodReadOnly,
} from '@/lib/daily'
import { listDailyProjectsForMember } from '@/lib/project-assignees'
import {
  getLinkedInBdActivityForDay,
  isLinkedInOutreachTask,
  mergeBdActivity,
  parseBdActivityJson,
} from '@/lib/salesrobot'
import { redirect, notFound } from 'next/navigation'
import EODClient from './EODClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function loadLinkedInBdActivity(
  log: {
    date: Date
    tasks: Array<{
      taskType: string
      bdActivityJson?: string | null
      project: { name: string } | null
    }>
  }
) {
  const needsLinkedIn = log.tasks.some(t => isLinkedInOutreachTask(t))
  if (!needsLinkedIn) return []
  const live = await getLinkedInBdActivityForDay(log.date)
  const savedTask = log.tasks.find(t => isLinkedInOutreachTask(t) && t.bdActivityJson)
  const saved = parseBdActivityJson(savedTask?.bdActivityJson)
  return mergeBdActivity(saved, live)
}

export default async function EODPage({ searchParams }: { searchParams: { logId?: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const memberId = session.user.id

  if (searchParams.logId && searchParams.logId !== 'undefined' && searchParams.logId !== '') {
    const log = await prisma.dailyLog.findUnique({
      where: { id: searchParams.logId },
      include: dailyLogWithTasksInclude,
    })
    if (!log) notFound()
    if (log.memberId !== memberId && session.user.role !== 'Founder') {
      redirect('/daily/eod')
    }

    const readOnly =
      log.memberId === memberId ? isEodReadOnly(log.eodSubmittedAt) : true
    const projects = await listDailyProjectsForMember(
      log.memberId,
      log.tasks.map(t => t.projectId ?? ''),
      session.user.role
    )
    const linkedInBdActivity = await loadLinkedInBdActivity(log)

    return (
      <EODClient
        log={log}
        projects={projects}
        readOnly={readOnly}
        linkedInBdActivity={linkedInBdActivity}
      />
    )
  }

  const openLog = await findOpenDailyLog(memberId)
  if (openLog) {
    const projects = await listDailyProjectsForMember(
      memberId,
      openLog.tasks.map(t => t.projectId ?? ''),
      session.user.role
    )
    const linkedInBdActivity = await loadLinkedInBdActivity(openLog)
    return (
      <EODClient log={openLog} projects={projects} linkedInBdActivity={linkedInBdActivity} />
    )
  }

  const editableLog = await findTodayEditableEodLog(memberId)
  if (editableLog) {
    const projects = await listDailyProjectsForMember(
      memberId,
      editableLog.tasks.map(t => t.projectId ?? ''),
      session.user.role
    )
    const linkedInBdActivity = await loadLinkedInBdActivity(editableLog)
    return (
      <EODClient
        log={editableLog}
        projects={projects}
        linkedInBdActivity={linkedInBdActivity}
      />
    )
  }

  return (
    <div className="py-8">
      <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-indigo-50/40 p-10 sm:p-14 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-3xl shadow-sm">
          🌙
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">No open plan found</h1>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          You either haven&apos;t submitted a morning plan yet, or your EOD is already done and can no longer be
          edited.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/daily/plan" className="btn-primary text-sm">
            Start today&apos;s plan →
          </Link>
          <Link href="/me" className="btn-secondary text-sm">
            My Day →
          </Link>
        </div>
      </div>
    </div>
  )
}
