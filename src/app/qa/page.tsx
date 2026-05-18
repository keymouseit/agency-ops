import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import { differenceInDays } from 'date-fns'

export const dynamic = 'force-dynamic'

const CYCLE_RESULT_CONFIG = {
  pass:        { label: 'Pass', cls: 'bg-green-100 text-green-800' },
  fail:        { label: 'Fail — blocked', cls: 'bg-red-100 text-red-800' },
  conditional: { label: 'Conditional', cls: 'bg-amber-100 text-amber-800' },
  pending:     { label: 'In progress', cls: 'bg-blue-100 text-blue-800' },
}

export default async function QAPage() {
  const [projects, recentIssues] = await Promise.all([
    prisma.project.findMany({
      where: { status: { in: ['active', 'qa', 'scoping'] } },
      include: {
        developer: true,
        testCycles: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { conductedBy: true, signOff: true },
        },
        releaseSignOff: { include: { signedOffBy: true } },
        postDeliveryIssues: { orderBy: { reportedAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.postDeliveryIssue.findMany({
      where: { resolvedAt: null },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { reportedAt: 'asc' },
      take: 10,
    }),
  ])

  const allProjects = await prisma.project.findMany({
    select: { id: true },
    where: { status: 'delivered' },
  })
  const allIssues = await prisma.postDeliveryIssue.findMany({
    select: { id: true, severity: true, wasInScope: true },
  })

  const qaProjects = projects.filter(p => p.status === 'qa')
  const needsFirstCycle = projects.filter(p => p.testCycles.length === 0)
  const blocked = projects.filter(p => p.testCycles[0]?.result === 'fail')
  const readyToSign = projects.filter(p =>
    p.testCycles[0]?.result === 'pass' && !p.releaseSignOff
  )
  const signedOff = projects.filter(p => !!p.releaseSignOff)

  const issuesMissed = allIssues.filter(i => i.wasInScope === true).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">QA — Release Gate</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Test cycles · Release sign-off · Post-delivery issues. Not a bug tracker.
          </p>
        </div>
        <Link href="/qa/checkin" className="btn-primary">+ Log test cycle</Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'In QA stage',         value: qaProjects.length,    sub: 'Awaiting sign-off',              danger: false },
          { label: 'Blocked — test fail',  value: blocked.length,       sub: 'Cannot release until fixed',     danger: blocked.length > 0 },
          { label: 'Ready for sign-off',   value: readyToSign.length,   sub: 'Test passed, needs sign-off',    danger: false },
          { label: 'Client issues (QA miss)', value: issuesMissed,      sub: 'Reported after delivery',        danger: issuesMissed > 0 },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{k.label}</div>
            <div className={`text-2xl font-semibold ${k.danger ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Unresolved post-delivery issues — top alert */}
      {recentIssues.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="text-sm font-semibold text-red-800 mb-3">
            {recentIssues.length} unresolved post-delivery issue{recentIssues.length > 1 ? 's' : ''} — client reported these after release
          </div>
          <div className="space-y-2">
            {recentIssues.map(issue => (
              <div key={issue.id} className="flex items-start justify-between text-sm">
                <div>
                  <span className={`badge mr-2 text-xs ${issue.severity === 'critical' ? 'bg-red-100 text-red-800' : issue.severity === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                    {issue.severity}
                  </span>
                  <span className="text-red-700 font-medium">{issue.project.name}</span>
                  <span className="text-red-600 ml-2">— {issue.description.slice(0, 80)}{issue.description.length > 80 ? '…' : ''}</span>
                </div>
                <Link href={`/qa/${issue.project.id}`} className="text-xs text-red-500 hover:underline ml-4 flex-shrink-0">
                  View →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project QA status */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Active projects — QA status
      </h2>
      <div className="space-y-3 mb-8">
        {projects.map(p => {
          const latestCycle = p.testCycles[0]
          const hasSignOff = !!p.releaseSignOff
          const daysSinceStart = p.testCycles.length > 0
            ? differenceInDays(new Date(), new Date(p.testCycles[p.testCycles.length - 1].startedAt))
            : null

          const statusLine = hasSignOff
            ? { label: '✓ Signed off', cls: 'bg-green-100 text-green-800' }
            : !latestCycle
            ? { label: 'No test cycle yet', cls: 'bg-gray-100 text-gray-500' }
            : CYCLE_RESULT_CONFIG[latestCycle.result as keyof typeof CYCLE_RESULT_CONFIG] ?? CYCLE_RESULT_CONFIG.pending

          return (
            <div key={p.id} className={`card p-4 border ${
              latestCycle?.result === 'fail' ? 'border-red-200 bg-red-50'
              : hasSignOff ? 'border-green-200 bg-green-50'
              : 'border-gray-100'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <Link href={`/qa/${p.id}`} className="text-base font-semibold text-gray-900 hover:underline">
                      {p.name}
                    </Link>
                    <span className={`badge text-xs ${statusLine.cls}`}>{statusLine.label}</span>
                    {p.qaSuggestedTestType && (
                      <span className="badge text-xs bg-purple-100 text-purple-700 capitalize">
                        {p.qaSuggestedTestType} test
                      </span>
                    )}
                    {latestCycle?.result === 'fail' && latestCycle.blockerNote && (
                      <span className="text-xs text-red-700 font-medium">
                        Blocked: {latestCycle.blockerNote.slice(0, 60)}{latestCycle.blockerNote.length > 60 ? '…' : ''}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Dev owner: {p.developer.name}</span>
                    {latestCycle && <span>Last cycle: {fmtDate(latestCycle.startedAt)} by {latestCycle.conductedBy.name}</span>}
                    {latestCycle && <span>Type: {latestCycle.cycleType.replace('_', ' ')}</span>}
                    {daysSinceStart !== null && <span>{p.testCycles.length} cycle{p.testCycles.length !== 1 ? 's' : ''} run</span>}
                    {hasSignOff && <span>Signed off: {fmtDate(p.releaseSignOff!.signedOffAt)} by {p.releaseSignOff!.signedOffBy.name}</span>}
                  </div>
                </div>
                <Link href={`/qa/${p.id}`} className="text-xs text-gray-400 hover:text-gray-700 ml-4 flex-shrink-0">
                  {hasSignOff ? 'View history →' : !latestCycle ? 'Start test cycle →' : 'View / continue →'}
                </Link>
              </div>
            </div>
          )
        })}
        {projects.length === 0 && (
          <div className="card p-8 text-center text-gray-400 text-sm">
            No active projects in QA. Projects appear here when their status is "active" or "qa".
          </div>
        )}
      </div>
    </div>
  )
}
