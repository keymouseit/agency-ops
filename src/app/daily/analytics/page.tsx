import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { eachDayOfInterval, format, startOfDay, subDays } from 'date-fns'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import DatePicker from './DatePicker'
import DailyTrendCharts from './DailyTrendCharts'

export const dynamic = 'force-dynamic'

function parseSelectedDate(raw?: string) {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return startOfDay(new Date(raw))
  }
  return startOfDay(new Date())
}

function dayKey(date: Date) {
  return format(startOfDay(new Date(date)), 'yyyy-MM-dd')
}

export default async function DailyAnalyticsPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'Founder') redirect('/daily')

  const selectedDate = parseSelectedDate(searchParams.date)
  const dateValue = format(selectedDate, 'yyyy-MM-dd')
  const isToday = dayKey(selectedDate) === dayKey(new Date())
  const thirtyDaysAgo = startOfDay(subDays(new Date(), 29))
  const today = startOfDay(new Date())

  const [members, logs, dayLogs] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.dailyLog.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      include: { member: true, tasks: true },
      orderBy: { date: 'desc' },
    }),
    prisma.dailyLog.findMany({
      where: { date: selectedDate },
      include: {
        member: true,
        tasks: { include: { project: { select: { name: true } } }, orderBy: { priority: 'asc' } },
      },
    }),
  ])

  const submittedIds = new Set(dayLogs.filter(l => l.planSubmittedAt).map(l => l.memberId))
  const submitted = members.filter(m => submittedIds.has(m.id))
  const missing = members.filter(m => !submittedIds.has(m.id))
  const eodPending = dayLogs.filter(l => l.planSubmittedAt && !l.eodSubmittedAt)
  const dayTasks = dayLogs.flatMap(l => l.tasks)
  const dayDone = dayTasks.filter(t => t.status === 'done').length

  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today })
  const logsByDay = new Map<string, typeof logs>()
  for (const log of logs) {
    const key = dayKey(log.date)
    const list = logsByDay.get(key) ?? []
    list.push(log)
    logsByDay.set(key, list)
  }

  const trend = days.map(day => {
    const key = dayKey(day)
    const dayEntries = logsByDay.get(key) ?? []
    const tasks = dayEntries.flatMap(l => l.tasks)
    return {
      label: format(day, 'd MMM'),
      plans: dayEntries.filter(l => l.planSubmittedAt).length,
      eods: dayEntries.filter(l => l.eodSubmittedAt).length,
      team: members.length,
      tasks: tasks.length,
      done: tasks.filter(t => t.status === 'done').length,
    }
  })

  const memberTrends = members.map(m => {
    const mine = logs.filter(l => l.memberId === m.id)
    return {
      name: m.name.split(' ')[0],
      tasks: mine.reduce((n, l) => n + l.tasks.length, 0),
      plans: mine.filter(l => l.planSubmittedAt).length,
    }
  })

  const workingDays = days.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length
  const memberStats = members.map(m => {
    const myLogs = logs.filter(l => l.memberId === m.id)
    const withPlan = myLogs.filter(l => l.planSubmittedAt)
    const withEOD = myLogs.filter(l => l.eodSubmittedAt)
    const allTasks = myLogs.flatMap(l => l.tasks)
    const doneTasks = allTasks.filter(t => t.status === 'done')
    const completionRate = allTasks.length > 0
      ? Math.round((doneTasks.length / allTasks.length) * 100)
      : null
    return {
      member: m,
      planRate: workingDays > 0 ? Math.round((withPlan.length / workingDays) * 100) : 0,
      eodRate: workingDays > 0 ? Math.round((withEOD.length / workingDays) * 100) : 0,
      completionRate,
      totalTasks: allTasks.length,
      totalDays: withPlan.length,
    }
  })

  const scoreColor = (v: number | null, good = 80, warn = 60) => {
    if (v === null) return 'text-gray-300'
    if (v >= good) return 'text-green-700'
    if (v >= warn) return 'text-amber-700'
    return 'text-red-600'
  }

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="badge bg-gray-100 text-gray-700">Founder</span>
              {isToday && <span className="badge bg-blue-100 text-blue-800">Today</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
              Daily report
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Who submitted a plan on {format(selectedDate, 'EEEE, d MMMM yyyy')} — plus 30-day trends.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <DatePicker value={dateValue} />
            <Link href="/daily" className="btn-secondary text-xs">
              ← Daily
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Plans submitted',
            value: `${submitted.length}/${members.length}`,
            good: submitted.length === members.length && members.length > 0,
            bad: missing.length > 0,
          },
          {
            label: 'Missing plans',
            value: missing.length.toString(),
            bad: missing.length > 0,
          },
          {
            label: 'EOD pending',
            value: eodPending.length.toString(),
            bad: eodPending.length > 0,
          },
          {
            label: 'Tasks that day',
            value: dayTasks.length.toString(),
            sub: dayDone > 0 ? `${dayDone} done` : undefined,
          },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">
              {stat.label}
            </div>
            <div
              className={`text-xl font-semibold ${
                stat.bad ? 'text-red-600' : stat.good ? 'text-green-700' : 'text-gray-900'
              }`}
            >
              {stat.value}
            </div>
            {stat.sub && <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Added a daily plan ({submitted.length})
          </h2>
          {submitted.length === 0 ? (
            <p className="text-sm text-gray-400">Nobody submitted a plan on this date.</p>
          ) : (
            <div className="space-y-2">
              {submitted.map(m => {
                const log = dayLogs.find(l => l.memberId === m.id)
                const taskCount = log?.tasks.length ?? 0
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{m.name}</div>
                      <div className="text-xs text-gray-400">{m.role}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500">{taskCount} task{taskCount === 1 ? '' : 's'}</span>
                      {log?.eodSubmittedAt ? (
                        <span className="badge bg-green-100 text-green-800">EOD in</span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-800">EOD pending</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Did not add a daily ({missing.length})
          </h2>
          {missing.length === 0 ? (
            <p className="text-sm text-green-700 font-medium">Everyone submitted a plan.</p>
          ) : (
            <div className="space-y-2">
              {missing.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.role}</div>
                  </div>
                  <span className="badge bg-red-100 text-red-800">No plan</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {dayLogs.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Tasks logged on this day</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Member</th>
                  <th className="text-left px-4 py-3 font-medium">Task</th>
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-center px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {dayLogs.flatMap(log =>
                  log.tasks.map(task => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-700">{log.member.name}</td>
                      <td className="px-4 py-2.5 text-gray-900">{task.title}</td>
                      <td className="px-4 py-2.5 text-gray-500">{task.project?.name ?? '—'}</td>
                      <td className="text-center px-3 py-2.5">
                        <span
                          className={`badge text-xs ${
                            task.status === 'done'
                              ? 'bg-green-100 text-green-800'
                              : task.status === 'blocked'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DailyTrendCharts daily={trend} members={memberTrends} />

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Team — last 30 working days</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Member</th>
              <th className="text-center px-3 py-3 font-medium">Plan rate</th>
              <th className="text-center px-3 py-3 font-medium">EOD rate</th>
              <th className="text-center px-3 py-3 font-medium">Task completion</th>
              <th className="text-center px-3 py-3 font-medium">Tasks</th>
              <th className="text-center px-3 py-3 font-medium">Plan days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {memberStats.map(s => (
              <tr key={s.member.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{s.member.name}</div>
                  <div className="text-xs text-gray-400">{s.member.role}</div>
                </td>
                <td className={`text-center px-3 py-3 font-semibold ${scoreColor(s.planRate)}`}>
                  {s.planRate}%
                </td>
                <td className={`text-center px-3 py-3 font-semibold ${scoreColor(s.eodRate)}`}>
                  {s.eodRate}%
                </td>
                <td className={`text-center px-3 py-3 font-semibold ${scoreColor(s.completionRate)}`}>
                  {s.completionRate !== null ? `${s.completionRate}%` : '—'}
                </td>
                <td className="text-center px-3 py-3 text-gray-600">{s.totalTasks}</td>
                <td className="text-center px-3 py-3 text-gray-600">{s.totalDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
