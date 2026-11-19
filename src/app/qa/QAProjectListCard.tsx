import Link from 'next/link'
import { fmtDate, STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/utils'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import { latestCycleProgress, projectMilestoneProgress } from '@/lib/qa-dashboard'
import { isBlockingCycleResult, QA_CYCLE_RESULT_CONFIG } from '@/lib/qa'
import { shortDisplayName } from '@/lib/employee-order'

const CYCLE_RESULT_CONFIG = QA_CYCLE_RESULT_CONFIG

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
  cases?: Array<{ status: string; devFixedAt: Date | string | null }>
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

export default function QAProjectListCard({
  project,
  canManage = false,
  canLogTestCycle = false,
}: {
  project: Project
  canManage?: boolean
  canLogTestCycle?: boolean
}) {
  const latestCycle = project.testCycles[0]
  const hasSignOff = !!project.releaseSignOff
  const milestoneProgress = projectMilestoneProgress(project.milestones)
  const cycleProgress = latestCycle ? latestCycleProgress(latestCycle as any) : null

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

  // When signed off, prefer shared QASignOffBadge only (avoid duplicate "Signed off" chip).
  const qaStatus = hasSignOff
    ? null
    : !latestCycle
      ? { label: 'No test cycle yet', cls: 'bg-gray-100 text-gray-600' }
      : CYCLE_RESULT_CONFIG[latestCycle.result as keyof typeof CYCLE_RESULT_CONFIG] ??
        CYCLE_RESULT_CONFIG.pending

  const overdue =
    project.estimatedEnd && new Date(project.estimatedEnd) < new Date() && project.status !== 'delivered'

  const showLog = canManage && canLogTestCycle && !hasSignOff
  const detailHref = `/qa/${project.id}`

  return (
    <article
      className={`rounded-2xl border bg-white shadow-sm overflow-hidden hover:border-gray-300 transition-colors ${
        latestCycle?.result === 'fail'
          ? 'border-red-200'
          : latestCycle?.result === 'blocked'
          ? 'border-orange-200'
          : hasSignOff
            ? 'border-green-200'
            : 'border-gray-200'
      }`}
    >
      <div className="px-4 py-3.5 space-y-3">
        {/* Title + primary status */}
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <Link
              href={detailHref}
              className="text-[15px] font-semibold text-gray-900 hover:text-gray-700 leading-snug break-words min-w-0 flex-1"
            >
              {project.name}
            </Link>
            <span
              className={`badge text-[10px] shrink-0 mt-0.5 ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>

          {/* Secondary chips — single wrap row */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {qaStatus && (
              <span className={`badge text-[10px] ${qaStatus.cls}`}>{qaStatus.label}</span>
            )}
            {hasSignOff && <QASignOffBadge signed />}
            {overdue && <span className="badge text-[10px] bg-red-100 text-red-800">Overdue</span>}
            {project.qaSuggestedTestType && (
              <span className="badge text-[10px] bg-purple-100 text-purple-700 capitalize">
                {project.qaSuggestedTestType} test
              </span>
            )}
          </div>
        </div>

        {/* People + due — compact two-line meta */}
        <div className="space-y-1.5 text-sm text-gray-500">
          <p className="leading-snug break-words">
            <span className="text-gray-400">Dev</span>{' '}
            {shortDisplayName(project.developer.name)}
            {project.bdMember && (
              <>
                <span className="text-gray-400 mx-3 text-base leading-none" aria-hidden>·</span>
                <span className="text-gray-400">BD</span>{' '}
                {shortDisplayName(project.bdMember.name)}
              </>
            )}
          </p>
          {project.estimatedEnd && (
            <p className="inline-flex items-center gap-1.5 leading-snug">
              <svg
                className="w-4 h-4 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>
                <span className="text-gray-400">Due</span> {fmtDate(project.estimatedEnd)}
              </span>
            </p>
          )}
          {latestCycle && (
            <p className="leading-snug break-words text-gray-400">
              Last cycle {fmtDate(latestCycle.startedAt)} ·{' '}
              {shortDisplayName(latestCycle.conductedBy.name)} ·{' '}
              {latestCycle.cycleType.replace('_', ' ')}
            </p>
          )}
          {hasSignOff && project.releaseSignOff && (
            <p className="leading-snug break-words text-gray-400">
              Signed off {fmtDate(project.releaseSignOff.signedOffAt)} ·{' '}
              {shortDisplayName(project.releaseSignOff.signedOffBy.name)}
            </p>
          )}
        </div>

        {/* Progress */}
        {totalMilestones > 0 || milestoneProgress.total > 0 ? (
          <div>
            <div className="flex items-center justify-between gap-3 mb-1.5">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Milestone progress
              </span>
              <span className="text-[11px] font-medium text-gray-600 tabular-nums">
                {pct}% · {milestoneLabel}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {(milestoneProgress.testing > 0 ||
              milestoneProgress.ready > 0 ||
              (cycleProgress && cycleProgress.total > 0)) && (
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                {milestoneProgress.testing > 0 && (
                  <span className="text-teal-600">{milestoneProgress.testing} in testing</span>
                )}
                {milestoneProgress.ready > 0 && (
                  <span className="text-blue-600">{milestoneProgress.ready} ready for QA</span>
                )}
                {cycleProgress && cycleProgress.total > 0 && (
                  <span>
                    Latest: {cycleProgress.passed}/{cycleProgress.total} passed
                    {cycleProgress.failed > 0 && (
                      <span className="text-red-600"> · {cycleProgress.failed} failed</span>
                    )}
                    {cycleProgress.blocked > 0 && (
                      <span className="text-orange-600"> · {cycleProgress.blocked} blocked</span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500">No milestones yet — open project to start QA.</p>
        )}

        {isBlockingCycleResult(latestCycle?.result ?? '') && latestCycle?.blockerNote && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              latestCycle.result === 'blocked'
                ? 'border-orange-200 bg-orange-50 text-orange-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            <span aria-hidden>{latestCycle.result === 'blocked' ? '⊘' : '✕'}</span>
            <span>
              <span className="font-medium">
                {latestCycle.result === 'blocked' ? 'Blocker:' : 'Failure:'}
              </span>{' '}
              {latestCycle.blockerNote}
            </span>
          </div>
        )}

        {/* Actions — full-width bottom row */}
        <div className={`grid gap-2 pt-0.5 ${showLog ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showLog && (
            <Link
              href={detailHref}
              className="btn-primary text-xs py-2 px-3 inline-flex items-center justify-center w-full"
            >
              + Log cycle
            </Link>
          )}
          <Link
            href={detailHref}
            className="btn-secondary text-xs py-2 px-3 inline-flex items-center justify-center w-full"
          >
            Details →
          </Link>
        </div>
      </div>
    </article>
  )
}
