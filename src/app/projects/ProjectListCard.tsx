import Link from 'next/link'
import { fmtCurrency, fmtDate, STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/utils'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import { projectListCardProgress } from '@/lib/qa-dashboard'

type Project = {
  id: string
  name: string
  status: string
  contractValue: number | null
  currency: string | null
  estimatedEnd: Date | null
  actualHours: number | null
  estimatedHours: number | null
  developer: { name: string }
  assignees?: Array<{ member: { name: string } }>
  bdMember: { name: string } | null
  checkIns: Array<{ onTrack?: string | null; blockers?: string | null; progressPct?: number | null }>
  scopeChanges: Array<{ changeOrderSigned: boolean }>
  milestones: Array<{ status: string }>
  releaseSignOff: object | null
}

function progressColor(pct: number) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-amber-400'
  if (pct >= 25) return 'bg-blue-500'
  return 'bg-gray-400'
}

export default function ProjectListCard({
  project,
  showValue,
}: {
  project: Project
  showValue: boolean
}) {
  const ci = project.checkIns[0]
  const { pct, milestone, detailLabel } = projectListCardProgress(project.milestones, ci)
  const unsigned = project.scopeChanges.filter(s => !s.changeOrderSigned).length
  const overdue =
    project.estimatedEnd && new Date(project.estimatedEnd) < new Date() && project.status !== 'delivered'
  const estAccuracy =
    project.actualHours && project.estimatedHours
      ? Math.round((project.actualHours / project.estimatedHours) * 100)
      : null

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:border-gray-300 transition-colors">
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Link
                href={`/projects/${project.id}`}
                className="text-base font-semibold text-gray-900 hover:text-gray-700 truncate"
              >
                {project.name}
              </Link>
              <span className={`badge text-[11px] ${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {PROJECT_STATUS_LABELS[project.status] ?? project.status}
              </span>
              {project.releaseSignOff && <QASignOffBadge signed />}
              {unsigned > 0 && (
                <span className="badge text-[11px] bg-red-100 text-red-800">{unsigned} CO missing</span>
              )}
              {overdue && <span className="badge text-[11px] bg-red-100 text-red-800">Overdue</span>}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span>
                <span className="text-gray-400">Dev</span>{' '}
                {[
                  project.developer.name,
                  ...(project.assignees ?? [])
                    .map(a => a.member.name)
                    .filter(name => name !== project.developer.name),
                ].join(', ')}
              </span>
              {project.bdMember && (
                <span>
                  <span className="text-gray-400">BD</span> {project.bdMember.name}
                </span>
              )}
              {project.contractValue && showValue && (
                <span>
                  <span className="text-gray-400">Value</span>{' '}
                  {fmtCurrency(project.contractValue, project.currency ?? undefined)}
                </span>
              )}
              {project.estimatedEnd && (
                <span>
                  <span className="text-gray-400">Due</span> {fmtDate(project.estimatedEnd)}
                </span>
              )}
              {estAccuracy != null && (
                <span className={estAccuracy > 120 ? 'text-red-600 font-medium' : ''}>
                  <span className="text-gray-400">Est. usage</span> {estAccuracy}%
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/projects/${project.id}`}
            className="btn-secondary text-xs px-3 py-1.5 shrink-0"
          >
            Details →
          </Link>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Progress</span>
          <span className="text-xs font-medium text-gray-600 tabular-nums">
            {pct}%{detailLabel ? ` · ${detailLabel}` : ''}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColor(pct)}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {(milestone.testing > 0 || milestone.ready > 0) && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
            {milestone.testing > 0 && (
              <span className="text-teal-600">{milestone.testing} in testing</span>
            )}
            {milestone.ready > 0 && (
              <span className="text-blue-600">{milestone.ready} ready for QA</span>
            )}
          </div>
        )}

        {ci?.blockers && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span aria-hidden>🚧</span>
            <span>
              <span className="font-medium">Blocker:</span> {ci.blockers}
            </span>
          </div>
        )}
      </div>
    </article>
  )
}
