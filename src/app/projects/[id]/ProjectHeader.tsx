import type { ReactNode } from 'react'
import Link from 'next/link'
import { fmtCurrency, fmtDate, PROJECT_STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { QASignOffBadge } from '@/components/QASignOffStatus'

type ProjectHeaderProps = {
  name: string
  status: string
  clientName: string | null
  developerNames: string[]
  bdName: string | null
  contractValue: number | null
  currency: string
  showValue: boolean
  leadSource: string | null
  startDate: Date | string | null
  estimatedEnd: Date | string | null
  estimatedHours: number | null
  actualHours: number | null
  progressPct: number
  completedMilestones: number
  inProgressMilestones: number
  totalMilestones: number
  releaseSignedOff: boolean
  techStack: string | null
  actions: ReactNode
}

export default function ProjectHeader({
  name,
  status,
  clientName,
  developerNames,
  bdName,
  contractValue,
  currency,
  showValue,
  leadSource,
  startDate,
  estimatedEnd,
  techStack,
  releaseSignedOff,
  actions,
}: ProjectHeaderProps) {
  const overdue =
    !!estimatedEnd &&
    new Date(estimatedEnd) < new Date() &&
    !['delivered', 'cancelled'].includes(status)

  const metaParts = [
    developerNames.length ? `Dev: ${developerNames.join(', ')}` : null,
    bdName ? `BD: ${bdName}` : null,
    clientName ? `Client: ${clientName}` : null,
    showValue && contractValue != null ? fmtCurrency(contractValue, currency) : null,
    techStack ? `Stack: ${techStack}` : null,
    leadSource ? `Source: ${leadSource}` : null,
    startDate || estimatedEnd
      ? `${startDate ? fmtDate(startDate) : '—'} → ${estimatedEnd ? fmtDate(estimatedEnd) : 'open'}`
      : null,
  ].filter(Boolean)

  return (
    <div className="mb-5">
      <div className="text-xs text-gray-400 mb-2">
        ←{' '}
        <Link href="/projects" className="hover:text-gray-700">
          Projects
        </Link>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">{name}</h1>
            <span className={`badge ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
              {PROJECT_STATUS_LABELS[status] ?? status}
            </span>
            {releaseSignedOff ? <QASignOffBadge signed /> : null}
            {overdue ? (
              <span className="badge bg-red-50 text-red-700">Past end date</span>
            ) : null}
          </div>

          {metaParts.length > 0 && (
            <p className="mt-1.5 text-sm text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
              {metaParts.map(part => (
                <span key={String(part)}>{part}</span>
              ))}
            </p>
          )}
        </div>

        <div className="shrink-0">{actions}</div>
      </div>
    </div>
  )
}
