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

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-300 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${project.id}`}
            className="text-[17px] font-semibold text-gray-900 hover:text-green-800 leading-snug"
          >
            {project.name}
          </Link>
          <p className="text-sm text-gray-500 mt-1.5">at {companyName}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill
              className={
                project.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : STATUS_COLORS[project.status] ?? 'bg-gray-100 text-gray-700'
              }
            >
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </Pill>
            {project.clientName && <Pill className="bg-slate-100 text-slate-700">Client · {project.clientName}</Pill>}
            <Pill className="bg-blue-50 text-blue-800">Assigned · {people.join(', ')}</Pill>
            {project.bdMember && (
              <Pill className="bg-violet-50 text-violet-800">Managed · {project.bdMember.name}</Pill>
            )}
            <Pill>{formatRange(project)}</Pill>
            {overdue && <Pill className="bg-red-50 text-red-700">Overdue</Pill>}
            {unsigned > 0 && <Pill className="bg-red-50 text-red-700">{unsigned} CO missing</Pill>}
            {project.releaseSignOff ? <QASignOffBadge signed /> : null}
            {project.checkIns[0]?.blockers && (
              <Pill className="bg-amber-50 text-amber-800">Blocker · {project.checkIns[0].blockers}</Pill>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center rounded-full border border-green-700 px-4 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50"
          >
            View details
          </Link>
          <p className="text-sm text-gray-700">{formatHours(project.actualHours)} hrs logged</p>
          {project.estimatedHours != null && (
            <p className="text-sm text-gray-400">{formatHours(project.estimatedHours)} hrs estimated</p>
          )}
        </div>
      </div>
    </article>
  )
}
