import type { ReactNode } from 'react'
import Link from 'next/link'
import { STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/utils'
import { formatIst } from '@/lib/ist'
import { QASignOffBadge } from '@/components/QASignOffStatus'

export type ProjectListCardProject = {
  id: string
  name: string
  status: string
  clientName: string | null
  startDate: Date | string | null
  createdAt: Date | string
  estimatedEnd: Date | string | null
  actualEnd: Date | string | null
  actualHours: number | null
  estimatedHours: number | null
  developer: { name: string }
  assignees?: Array<{ member: { name: string } }>
  bdMember: { name: string } | null
  checkIns: Array<{ blockers?: string | null }>
  scopeChanges: Array<{ changeOrderSigned: boolean }>
  releaseSignOff: object | null
  milestones?: Array<{ status: string; dueDate?: Date | string | null }>
}

function formatHours(n: number | null | undefined) {
  const hours = n ?? 0
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function formatRange(project: ProjectListCardProject) {
  const start = project.startDate || project.createdAt
  const startLabel = formatIst(start, { month: 'short', day: 'numeric' }, 'en-US')
  if (project.status === 'delivered' && (project.actualEnd || project.estimatedEnd)) {
    const end = project.actualEnd || project.estimatedEnd
    return `${startLabel} – ${formatIst(end!, { month: 'short', day: 'numeric' }, 'en-US')}`
  }
  if (project.estimatedEnd && ['cancelled'].includes(project.status)) {
    return `${startLabel} – ${formatIst(project.estimatedEnd, { month: 'short', day: 'numeric' }, 'en-US')}`
  }
  return `${startLabel} – Present`
}

function assigneeNames(project: ProjectListCardProject) {
  return [
    project.developer.name,
    ...(project.assignees ?? []).map(a => a.member.name).filter(name => name !== project.developer.name),
  ]
}

const STATUS_DOT: Record<string, string> = {
  scoping: 'bg-sky-500',
  active: 'bg-emerald-500',
  qa: 'bg-violet-500',
  on_hold: 'bg-amber-500',
  maintenance: 'bg-cyan-500',
  delivered: 'bg-green-600',
  cancelled: 'bg-gray-400',
}

function Pill({
  children,
  className = 'bg-gray-100 text-gray-700',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

export default function ProjectListCard({
  project,
  companyName,
}: {
  project: ProjectListCardProject
  companyName: string
}) {
  const unsigned = project.scopeChanges.filter(s => !s.changeOrderSigned).length
  const overdue =
    project.estimatedEnd &&
    new Date(project.estimatedEnd) < new Date() &&
    !['delivered', 'cancelled'].includes(project.status)
  const people = assigneeNames(project)
  const statusLabel = PROJECT_STATUS_LABELS[project.status] ?? project.status
  const statusClass =
    project.status === 'active'
      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
      : `${STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'} ring-black/5`
  const metaParts = [
    project.clientName ? `Client · ${project.clientName}` : null,
    people.length ? `Assigned · ${people.join(', ')}` : null,
    project.bdMember ? `Managed · ${project.bdMember.name}` : null,
    formatRange(project),
  ].filter(Boolean) as string[]

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm hover:border-gray-300 hover:shadow-md transition-all">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/projects/${project.id}`}
              className="text-[17px] font-semibold text-gray-900 hover:text-green-800 leading-snug break-words"
            >
              {project.name}
            </Link>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[project.status] ?? 'bg-gray-400'}`}
                aria-hidden
              />
              {statusLabel}
            </span>
            {project.releaseSignOff ? <QASignOffBadge signed /> : null}
          </div>

          <p className="text-sm text-gray-500 mt-1.5">at {companyName}</p>

          {metaParts.length > 0 && (
            <p className="mt-2 text-sm text-gray-600 leading-relaxed break-words">
              {metaParts.map((part, i) => (
                <span key={part}>
                  {i > 0 && <span className="text-gray-300 mx-1.5">·</span>}
                  {part}
                </span>
              ))}
            </p>
          )}

          {(overdue || unsigned > 0 || project.checkIns[0]?.blockers) && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {overdue && <Pill className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">Overdue</Pill>}
              {unsigned > 0 && (
                <Pill className="bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">{unsigned} CO missing</Pill>
              )}
              {project.checkIns[0]?.blockers && (
                <Pill className="bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100">
                  Blocker · {project.checkIns[0].blockers}
                </Pill>
              )}
            </div>
          )}
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center rounded-full border border-green-700 px-4 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50 whitespace-nowrap"
          >
            View details
          </Link>
          <div className="text-right">
            <p className="text-sm text-gray-700">{formatHours(project.actualHours)} hrs logged</p>
            {project.estimatedHours != null && (
              <p className="text-sm text-gray-400">{formatHours(project.estimatedHours)} hrs estimated</p>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
