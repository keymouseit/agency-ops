import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { format, startOfDay, subDays } from 'date-fns'

export const dynamic = 'force-dynamic'

const TASK_TYPE_COLORS: Record<string, string> = {
  feature:  'bg-blue-100 text-blue-800',
  bug:      'bg-red-100 text-red-800',
  review:   'bg-purple-100 text-purple-800',
  meeting:  'bg-gray-100 text-gray-700',
  admin:    'bg-gray-100 text-gray-500',
  qa:       'bg-teal-100 text-teal-800',
  research: 'bg-amber-100 text-amber-800',
}

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500', medium: 'bg-amber-400', low: 'bg-gray-300',
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-600',
  done:    'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
  moved:   'bg-gray-100 text-gray-500',
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const targetDate = searchParams.date
    ? startOfDay(new Date(searchParams.date))
    : startOfDay(new Date())

  const [members, logs] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.dailyLog.findMany({
      where: { date: targetDate },
      include: {
        member: true,
        tasks: { include: { project: { select: { name: true } } }, orderBy: { priority: 'asc' } },
      },
    }),
  ])

  const isToday = targetDate.toDateString() === new Date().toDateString()
  const prevDate = format(subDays(targetDate, 1), 'yyyy-MM-dd')
  const nextDate = format(new Date(targetDate.getTime() + 86400000), 'yyyy-MM-dd')

  // who's missing what
  const membersWithLog = new Set(logs.map(l => l.memberId))
  const noPlan = members.filter(m => !membersWithLog.has(m.id))
  const noEOD = logs.filter(l => l.planSubmittedAt && !l.eodSubmittedAt)
  const hasBlockers = logs.filter(l => l.blockers && l.blockers.trim())

  // team-wide stats
  const allTasks = logs.flatMap(l => l.tasks)
  const plannedTasks = allTasks.length
  const doneTasks = allTasks.filter(t => t.status === 'done').length
  const blockedTasks = allTasks.filter(t => t.status === 'blocked').length
  const totalEstHours = allTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const totalActHours = allTasks.filter(t => t.eodNotes !== null || t.status !== 'planned')
    .reduce((s, t) => s + (t.actualHours ?? 0), 0)

  return (
    <div>
      {/* Header with date nav */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Daily ops</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(targetDate, 'EEEE, d MMMM yyyy')}
            {isToday && <span className="ml-2 badge bg-blue-100 text-blue-800">Today</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/daily?date=${prevDate}`} className="btn-secondary text-xs px-3">← Prev</Link>
          {!isToday && <Link href="/daily" className="btn-secondary text-xs px-3">Today</Link>}
          <Link href={`/daily?date=${nextDate}`} className="btn-secondary text-xs px-3">Next →</Link>
          <Link href="/daily/plan" className="btn-primary text-xs">+ Morning plan</Link>
        </div>
      </div>

      {/* Alerts — missing submissions */}
      {isToday && (noPlan.length > 0 || noEOD.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {noPlan.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="text-xs font-semibold text-red-800 mb-1">
                No morning plan submitted ({noPlan.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {noPlan.map(m => (
                  <span key={m.id} className="badge bg-red-100 text-red-700 text-xs">{m.name.split(' ')[0]}</span>
                ))}
              </div>
            </div>
          )}
          {noEOD.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="text-xs font-semibold text-amber-800 mb-1">
                Plan submitted, EOD pending ({noEOD.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {noEOD.map(l => (
                  <span key={l.id} className="badge bg-amber-100 text-amber-700 text-xs">{l.member.name.split(' ')[0]}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Blockers — elevated */}
      {hasBlockers.length > 0 && (
        <div className="mb-6 space-y-2">
          {hasBlockers.map(l => (
            <div key={l.id} className="flex gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <span className="font-medium text-red-800">{l.member.name}</span>
                <span className="text-red-700 ml-2">{l.blockers}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Team summary row */}
      {plannedTasks > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Tasks planned', value: plannedTasks.toString() },
            { label: 'Tasks done', value: doneTasks.toString(), good: doneTasks === plannedTasks },
            { label: 'Tasks blocked', value: blockedTasks.toString(), bad: blockedTasks > 0 },
            { label: 'Hours logged', value: totalActHours > 0 ? `${totalActHours}h / ${totalEstHours}h` : `${totalEstHours}h planned` },
          ].map(k => (
            <div key={k.label} className="card p-4">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
              <div className={`text-xl font-semibold ${k.bad ? 'text-red-600' : k.good ? 'text-green-700' : 'text-gray-900'}`}>
                {k.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Per-person cards */}
      {logs.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-gray-400 text-sm mb-2">No plans submitted for this day yet.</div>
          {isToday && <Link href="/daily/plan" className="btn-primary text-sm">Submit morning plan →</Link>}
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map(log => {
            const done = log.tasks.filter(t => t.status === 'done').length
            const total = log.tasks.length
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const hasEOD = !!log.eodSubmittedAt

            return (
              <div key={log.id} className="card overflow-hidden">
                {/* Member header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-800">
                      {log.member.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{log.member.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{log.member.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Completion bar */}
                    {total > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{done}/{total}</span>
                      </div>
                    )}
                    {log.dayRating && (
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded ${log.dayRating >= 4 ? 'bg-green-100 text-green-800' : log.dayRating >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        Day: {log.dayRating}/5
                      </div>
                    )}
                    <span className={`badge text-xs ${hasEOD ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {hasEOD ? 'EOD done' : 'EOD pending'}
                    </span>
                    {!hasEOD && (
                      <Link href={`/daily/eod?logId=${log.id}`} className="text-xs text-blue-600 hover:underline">
                        Submit EOD →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Task list */}
                <div className="divide-y divide-gray-50">
                  {log.tasks.map(task => (
                    <div key={task.id} className={`px-5 py-3 flex items-start gap-3 ${task.status === 'done' ? 'opacity-75' : ''}`}>
                      {/* Priority dot */}
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                            {task.title}
                          </span>
                          <span className={`badge text-xs ${TASK_TYPE_COLORS[task.taskType] ?? 'bg-gray-100 text-gray-600'}`}>
                            {task.taskType}
                          </span>
                          {task.project && (
                            <span className="text-xs text-gray-400">{task.project.name}</span>
                          )}
                        </div>
                        {task.eodNotes && (
                          <p className="text-xs text-gray-500 mt-0.5">{task.eodNotes}</p>
                        )}
                        {task.blockedReason && (
                          <p className="text-xs text-red-600 mt-0.5">Blocked: {task.blockedReason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.estimatedHours && (
                          <span className="text-xs text-gray-400">
                            {task.actualHours != null
                              ? <span className={task.actualHours > (task.estimatedHours * 1.3) ? 'text-red-500' : 'text-gray-400'}>
                                  {task.actualHours}h / {task.estimatedHours}h
                                </span>
                              : `${task.estimatedHours}h est.`}
                          </span>
                        )}
                        <span className={`badge text-xs ${STATUS_COLORS[task.status] ?? 'bg-gray-100'}`}>
                          {task.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {log.tasks.length === 0 && (
                    <div className="px-5 py-3 text-xs text-gray-400">No tasks in plan.</div>
                  )}
                </div>

                {/* EOD summary if submitted */}
                {hasEOD && (log.carryOver || log.eodNotes) && (
                  <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 text-xs space-y-1">
                    {log.carryOver && (
                      <div><span className="font-medium text-blue-800">Carries to tomorrow:</span>
                        <span className="text-blue-700 ml-1">{log.carryOver}</span></div>
                    )}
                    {log.eodNotes && (
                      <div><span className="font-medium text-blue-800">Notes:</span>
                        <span className="text-blue-700 ml-1">{log.eodNotes}</span></div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
