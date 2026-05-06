import { prisma } from '@/lib/prisma'
import { startOfDay, subDays, format, eachDayOfInterval } from 'date-fns'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DailyAnalyticsPage() {
  const thirtyDaysAgo = startOfDay(subDays(new Date(), 29))
  const today = startOfDay(new Date())

  const [members, logs] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.dailyLog.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      include: {
        member: true,
        tasks: true,
      },
      orderBy: { date: 'desc' },
    }),
  ])

  const days = eachDayOfInterval({ start: thirtyDaysAgo, end: today })

  // Per-member stats
  const memberStats = members.map(m => {
    const myLogs = logs.filter(l => l.memberId === m.id)
    const withPlan = myLogs.filter(l => l.planSubmittedAt)
    const withEOD = myLogs.filter(l => l.eodSubmittedAt)

    const allTasks = myLogs.flatMap(l => l.tasks)
    const doneTasks = allTasks.filter(t => t.status === 'done')
    const blockedTasks = allTasks.filter(t => t.status === 'blocked')

    // Completion rate
    const completionRate = allTasks.length > 0
      ? Math.round((doneTasks.length / allTasks.length) * 100)
      : null

    // Estimation accuracy — actual/estimated ratio
    const tasksWithHours = allTasks.filter(t => t.estimatedHours && t.actualHours)
    const estAccuracy = tasksWithHours.length > 0
      ? Math.round(
          (tasksWithHours.reduce((s, t) => s + t.actualHours! / t.estimatedHours!, 0)
            / tasksWithHours.length) * 100
        )
      : null

    // Avg day rating
    const ratings = myLogs.filter(l => l.dayRating).map(l => l.dayRating!)
    const avgRating = ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : null

    // Plan submission rate (out of working days in last 30)
    const workingDays = days.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length
    const planRate = Math.round((withPlan.length / workingDays) * 100)
    const eodRate = Math.round((withEOD.length / workingDays) * 100)

    // Most common blocked reason
    const blockReasons = blockedTasks
      .map(t => t.blockedReason)
      .filter(Boolean) as string[]

    return {
      member: m,
      planRate,
      eodRate,
      completionRate,
      estAccuracy,
      avgRating,
      totalDays: withPlan.length,
      totalTasks: allTasks.length,
      blockedCount: blockedTasks.length,
      blockReasons,
    }
  })

  // Task type breakdown across all logs
  const allTasks = logs.flatMap(l => l.tasks)
  const byType = allTasks.reduce((acc, t) => {
    acc[t.taskType] = (acc[t.taskType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Day-by-day team completion for the last 14 days
  const last14 = days.slice(-14)
  const dailyCompletion = last14.map(day => {
    const dayLogs = logs.filter(
      l => startOfDay(new Date(l.date)).toISOString() === day.toISOString()
    )
    const tasks = dayLogs.flatMap(l => l.tasks)
    const done = tasks.filter(t => t.status === 'done').length
    const planned = tasks.length
    return {
      date: day,
      planned,
      done,
      rate: planned > 0 ? Math.round((done / planned) * 100) : null,
      submitted: dayLogs.filter(l => l.planSubmittedAt).length,
      eod: dayLogs.filter(l => l.eodSubmittedAt).length,
    }
  })

  // Blocked task patterns
  const allBlockedTasks = allTasks.filter(t => t.status === 'blocked' && t.blockedReason)
  const blockCategories = {
    'Waiting on client': allBlockedTasks.filter(t =>
      t.blockedReason?.toLowerCase().includes('client')).length,
    'Access / environment': allBlockedTasks.filter(t =>
      t.blockedReason?.toLowerCase().match(/access|env|server|staging|deploy/)).length,
    'Dependency on team': allBlockedTasks.filter(t =>
      t.blockedReason?.toLowerCase().match(/waiting|team|review|pr|merge/)).length,
    'Unclear requirements': allBlockedTasks.filter(t =>
      t.blockedReason?.toLowerCase().match(/unclear|requirement|spec|brief/)).length,
    'Technical blocker': allBlockedTasks.filter(t =>
      t.blockedReason?.toLowerCase().match(/bug|error|crash|api|sdk/)).length,
    'Other': 0,
  }
  blockCategories['Other'] = allBlockedTasks.length -
    Object.values(blockCategories).reduce((a, b) => a + b, 0)

  const scoreColor = (v: number | null, good = 80, warn = 60) => {
    if (v === null) return 'text-gray-300'
    if (v >= good) return 'text-green-700'
    if (v >= warn) return 'text-amber-700'
    return 'text-red-600'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Daily analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Last 30 days — patterns, completion rates, blockers.</p>
        </div>
        <Link href="/daily" className="btn-secondary text-sm">← Today's view</Link>
      </div>

      {/* Per-member summary table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Team — last 30 days</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Member</th>
              <th className="text-center px-3 py-3 font-medium">Plan rate</th>
              <th className="text-center px-3 py-3 font-medium">EOD rate</th>
              <th className="text-center px-3 py-3 font-medium">Task completion</th>
              <th className="text-center px-3 py-3 font-medium">Est. accuracy</th>
              <th className="text-center px-3 py-3 font-medium">Avg day rating</th>
              <th className="text-center px-3 py-3 font-medium">Blocked tasks</th>
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
                <td className={`text-center px-3 py-3 font-semibold ${
                  s.estAccuracy === null ? 'text-gray-300'
                  : s.estAccuracy <= 115 ? 'text-green-700'
                  : s.estAccuracy <= 140 ? 'text-amber-700'
                  : 'text-red-600'
                }`}>
                  {s.estAccuracy !== null ? `${s.estAccuracy}%` : '—'}
                </td>
                <td className={`text-center px-3 py-3 font-semibold ${
                  s.avgRating === null ? 'text-gray-300'
                  : parseFloat(s.avgRating!) >= 4 ? 'text-green-700'
                  : parseFloat(s.avgRating!) >= 3 ? 'text-amber-700'
                  : 'text-red-600'
                }`}>
                  {s.avgRating ?? '—'}
                </td>
                <td className={`text-center px-3 py-3 font-semibold ${
                  s.blockedCount === 0 ? 'text-gray-400' : s.blockedCount > 5 ? 'text-red-600' : 'text-amber-700'
                }`}>
                  {s.blockedCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex gap-6">
          <span>Plan rate — submitted morning plans out of working days</span>
          <span>Est. accuracy — actual hours / estimated hours (100% = perfect)</span>
          <span>Completion — done tasks / planned tasks</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* 14-day daily completion trend */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Team task completion — last 14 days
          </h2>
          <div className="space-y-2">
            {dailyCompletion.map(d => {
              const isWeekend = d.date.getDay() === 0 || d.date.getDay() === 6
              if (isWeekend) return null
              const barPct = d.rate ?? 0
              return (
                <div key={d.date.toISOString()} className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400 w-20 flex-shrink-0">
                    {format(d.date, 'EEE d MMM')}
                  </span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        barPct >= 80 ? 'bg-green-500'
                        : barPct >= 50 ? 'bg-amber-400'
                        : barPct > 0 ? 'bg-red-400'
                        : 'bg-gray-100'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span className={`w-10 text-right font-medium ${
                    d.rate === null ? 'text-gray-300'
                    : d.rate >= 80 ? 'text-green-700'
                    : d.rate >= 50 ? 'text-amber-700'
                    : 'text-red-600'
                  }`}>
                    {d.rate !== null ? `${d.rate}%` : '—'}
                  </span>
                  <span className="text-gray-300 w-16">
                    {d.submitted > 0 ? `${d.submitted} planned` : 'no plans'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Blocker patterns */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Blocker patterns — last 30 days
          </h2>
          {allBlockedTasks.length === 0 ? (
            <p className="text-sm text-green-700 font-medium">No blocked tasks in the last 30 days. </p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {(Object.entries(blockCategories) as [string, number][])
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, count]) => (
                    <div key={category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{category}</span>
                        <span className="font-medium text-gray-800">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${(count / allBlockedTasks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="text-xs text-gray-400">
                {allBlockedTasks.length} total blocked tasks across {members.length} team members
              </div>
            </>
          )}
        </div>
      </div>

      {/* Task type breakdown */}
      <div className="card p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">
          What is the team spending time on? — last 30 days
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(byType) as [string, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => {
              const pct = allTasks.length > 0 ? Math.round((count / allTasks.length) * 100) : 0
              const typeColors: Record<string, string> = {
                feature: 'bg-blue-500',
                bug: 'bg-red-500',
                review: 'bg-purple-500',
                meeting: 'bg-gray-400',
                admin: 'bg-gray-300',
                qa: 'bg-teal-500',
                research: 'bg-amber-500',
              }
              return (
                <div key={type} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${typeColors[type] ?? 'bg-gray-400'}`} />
                    <span className="text-xs font-medium text-gray-700 capitalize">{type}</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900">{pct}%</div>
                  <div className="text-xs text-gray-400">{count} tasks</div>
                </div>
              )
            })}
        </div>
        {allTasks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No task data yet.</p>
        )}
      </div>

      {/* Recent individual daily logs summary */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent daily logs</h2>
          <Link href="/daily" className="text-xs text-gray-400 hover:text-gray-600">Today's view →</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-400 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">Member</th>
              <th className="text-center px-3 py-3 font-medium">Tasks</th>
              <th className="text-center px-3 py-3 font-medium">Done</th>
              <th className="text-center px-3 py-3 font-medium">Completion</th>
              <th className="text-center px-3 py-3 font-medium">Day rating</th>
              <th className="text-center px-3 py-3 font-medium">EOD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {logs.slice(0, 30).map(log => {
              const done = log.tasks.filter(t => t.status === 'done').length
              const total = log.tasks.length
              const pct = total > 0 ? Math.round((done / total) * 100) : null
              return (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {format(new Date(log.date), 'EEE d MMM')}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{log.member.name}</td>
                  <td className="text-center px-3 py-2.5 text-gray-600">{total}</td>
                  <td className="text-center px-3 py-2.5 text-gray-600">{done}</td>
                  <td className={`text-center px-3 py-2.5 font-semibold ${
                    pct === null ? 'text-gray-300'
                    : pct === 100 ? 'text-green-700'
                    : pct >= 70 ? 'text-amber-700'
                    : 'text-red-600'
                  }`}>
                    {pct !== null ? `${pct}%` : '—'}
                  </td>
                  <td className={`text-center px-3 py-2.5 font-semibold ${
                    !log.dayRating ? 'text-gray-300'
                    : log.dayRating >= 4 ? 'text-green-700'
                    : log.dayRating === 3 ? 'text-amber-700'
                    : 'text-red-600'
                  }`}>
                    {log.dayRating ? `${log.dayRating}/5` : '—'}
                  </td>
                  <td className="text-center px-3 py-2.5">
                    {log.eodSubmittedAt
                      ? <span className="badge bg-green-100 text-green-800 text-xs">Done</span>
                      : <span className="badge bg-amber-100 text-amber-800 text-xs">Pending</span>}
                  </td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400 text-sm">
                  No daily logs yet.{' '}
                  <Link href="/daily/plan" className="text-blue-600 hover:underline">Submit first plan →</Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
