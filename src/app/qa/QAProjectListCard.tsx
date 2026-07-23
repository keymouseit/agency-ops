import Link from 'next/link'
import { fmtDate, STATUS_COLORS } from '@/lib/utils'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import { latestCycleProgress, projectMilestoneProgress } from '@/lib/qa-dashboard'

const PROJECT_STATUS_LABELS: Record<string, string> = {
  scoping: 'Scoping',
  active: 'Active',
  qa: 'QA',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const CYCLE_RESULT_CONFIG = {
  pass: { label: 'Pass', cls: 'bg-green-100 text-green-800' },
  fail: { label: 'Fail — blocked', cls: 'bg-red-100 text-red-800' },
  conditional: { label: 'Conditional', cls: 'bg-amber-100 text-amber-800' },
  pending: { label: 'In progress', cls: 'bg-blue-100 text-blue-800' },
}

type Milestone = {
  status: string
  testCases?: Array<{ status: string }>
}

type TestCycle = {
  result: string
  startedAt: Date
  cycleType: string
  blockerNote: string | null
  conductedBy: { name: string }
  cases?: Array<{ status: string; devFixedAt: Date | null }>
}

type Project = {
  id: string
  name: string
  status: string
  estimatedEnd: Date | null
  qaSuggestedTestType: string | null
  developer: { name: string }
  bdMember: { name: string } | null
  milestones: Milestone[]
  testCycles: TestCycle[]
  releaseSignOff: { signedOffAt: Date; signedOffBy: { name: string } } | null
}

function progressColor(pct: number) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-amber-400'
  if (pct >= 25) return 'bg-blue-500'
  return 'bg-gray-400'
}

export default function QAProjectListCard({ project }: { project: Project }) {
  const latestCycle = project.testCycles[0]
  const hasSignOff = !!project.releaseSignOff
  const milestoneProgress = projectMilestoneProgress(project.milestones)
  const cycleProgress = latestCycle ? latestCycleProgress(latestCycle) : null

  const totalMilestones = project.milestones.length
  const completedMilestones = project.milestones.filter(m => m.status === 'done').length
  const pct =
    milestoneProgress.total > 0
      ? milestoneProgress.pct
      : totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0
  const milestoneLabel =
    milestoneProgress.total > 0
      ? `${milestoneProgress.approved}/${milestoneProgress.total} approved`
      : `${completedMilestones}/${totalMilestones}`

  const qaStatus = hasSignOff
    ? { label: '✓ Signed off', cls: 'bg-green-100 text-green-800' }
    : !latestCycle
      ? { label: 'No test cycle yet', cls: 'bg-gray-100 text-gray-600' }
      : CYCLE_RESULT_CONFIG[latestCycle.result as keyof typeof CYCLE_RESULT_CONFIG] ??
        CYCLE_RESULT_CONFIG.pending

  const overdue =
    project.estimatedEnd && new Date(project.estimatedEnd) < new Date() && project.status !== 'delivered'

  return (
    <article
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden hover:border-gray-300 transition-colors ${
        latestCycle?.result === 'fail'
          ? 'border-red-200'
          : hasSignOff
            ? 'border-green-200'
            : 'border-gray-200'
      }`}
    >
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Link
                href={`/qa/${project.id}`}
                className="text-base font-semibold text-gray-900 hover:text-gray-700 truncate"
              >
                {project.name}
              </Link>
              <span className={`badge text-[11px] ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </span>
              <span className={`badge text-[11px] ${qaStatus.cls}`}>{qaStatus.label}</span>
              {hasSignOff && <QASignOffBadge signed />}
              {overdue && <span className="badge text-[11px] bg-red-100 text-red-800">Overdue</span>}
              {project.qaSuggestedTestType && (
                <span className="badge text-[11px] bg-purple-100 text-purple-700 capitalize">
                  {project.qaSuggestedTestType} test
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                <span className="text-gray-400">Dev</span> {project.developer.name}
              </span>
              {project.bdMember && (
                <span>
                  <span className="text-gray-400">BD</span> {project.bdMember.name}
                </span>
              )}
              {project.estimatedEnd && (
                <span>
                  <span className="text-gray-400">Due</span> {fmtDate(project.estimatedEnd)}
                </span>
              )}
              {latestCycle && (
                <span>
                  <span className="text-gray-400">Last cycle</span> {fmtDate(latestCycle.startedAt)} ·{' '}
                  {latestCycle.conductedBy.name}
                </span>
              )}
              {latestCycle && (
                <span>
                  <span className="text-gray-400">Type</span> {latestCycle.cycleType.replace('_', ' ')}
                </span>
              )}
              {hasSignOff && project.releaseSignOff && (
                <span>
                  <span className="text-gray-400">Signed off</span>{' '}
                  {fmtDate(project.releaseSignOff.signedOffAt)}
                </span>
              )}
            </div>
          </div>
          <Link href={`/qa/${project.id}`} className="btn-secondary text-xs px-3 py-1.5 shrink-0">
            Details →
          </Link>
        </div>
      </div>

      <div className="px-5 py-4">
        {totalMilestones > 0 || milestoneProgress.total > 0 ? (
          <>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                Milestone progress
              </span>
              <span className="text-xs font-medium text-gray-600 tabular-nums">
                {pct}% · {milestoneLabel}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {(milestoneProgress.testing > 0 ||
              milestoneProgress.ready > 0 ||
              (cycleProgress && cycleProgress.total > 0)) && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                {milestoneProgress.testing > 0 && (
                  <span className="text-teal-600">{milestoneProgress.testing} in testing</span>
                )}
                {milestoneProgress.ready > 0 && (
                  <span className="text-blue-600">{milestoneProgress.ready} ready for QA</span>
                )}
                {cycleProgress && cycleProgress.total > 0 && (
                  <span>
                    Latest cycle: {cycleProgress.passed}/{cycleProgress.total} passed
                    {cycleProgress.failing > 0 && (
                      <span className="text-red-600"> · {cycleProgress.failing} failing</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">No milestones yet — open project to start QA.</p>
        )}

        {latestCycle?.result === 'fail' && latestCycle.blockerNote && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            <span aria-hidden>🚧</span>
            <span>
              <span className="font-medium">Blocked:</span> {latestCycle.blockerNote}
            </span>
          </div>
        )}
      </div>
    </article>
  )
}
