import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, LOSS_REASONS, FAULT_AREAS, STATUS_COLORS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import LeadActions from './LeadActions'
import Link from 'next/link'
import EntityAuditTrail from '@/components/EntityAuditTrail'

export const dynamic = 'force-dynamic'

export default async function LeadPage({ params }: { params: { id: string } }) {
  const [lead, members] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        owner: true,
        proposals: { include: { writtenBy: true }, orderBy: { sentAt: 'desc' } },
        lossAnalysis: { include: { } },
        project: { select: { id: true, name: true, status: true } },
        estimationRequests: {
          include: {
            assignee: true,
            requester: true,
            record: {
              include: {
                estimatedBy: true,
                lines: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  if (!lead) notFound()

  const STAGE_LABELS: Record<string, string> = {
    new: 'New lead', proposal_sent: 'Proposal sent', interview: 'Interview',
    won: 'Won', lost: 'Lost',
  }

  const estReq = lead.estimationRequests[0]
  const estRecord = estReq?.record

  const estStatusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-600',
    in_progress: 'bg-blue-100 text-blue-800',
    submitted: 'bg-amber-100 text-amber-800',
    revision: 'bg-red-100 text-red-700',
    confirmed: 'bg-purple-100 text-purple-800',
    approved: 'bg-green-100 text-green-800',
    sent: 'bg-teal-100 text-teal-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-6 min-w-0">
        <div className="text-xs text-gray-400 mb-1">← <a href="/pipeline" className="hover:text-gray-700">Pipeline</a></div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 break-words">{lead.clientName}</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-gray-500">
          <span>{lead.source}</span>
          <span className="text-gray-300">·</span>
          <span>Owner: {lead.owner.name}</span>
          <span className="text-gray-300">·</span>
          <span>{fmtCurrency(lead.budget, lead.currency)}</span>
          <span className={`badge ${STATUS_COLORS[lead.status]}`}>{STAGE_LABELS[lead.status]}</span>
        </div>
        {lead.description && <p className="mt-2 text-sm text-gray-600 max-w-xl break-words">{lead.description}</p>}
      </div>

      {/* Link to project if won */}
      {lead.project && (
        <div className="card p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-green-50 border-green-100">
          <span className="text-sm font-medium text-green-800 break-words">Converted to project: {lead.project.name}</span>
          <a href={`/projects/${lead.project.id}`} className="text-xs text-green-700 underline shrink-0">View project →</a>
        </div>
      )}

      {/* Estimation block */}
      <div className="card p-4 sm:p-5 mb-4 min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Estimation</h2>
          <Link href={`/estimate/${lead.id}`} className="btn-primary text-xs shrink-0">
            {estReq ? 'Open estimation →' : '+ Request estimate'}
          </Link>
        </div>

        {!estReq ? (
          <p className="text-sm text-amber-600">
            No estimation started. BD should request an estimate from a developer before sending any proposal.
          </p>
        ) : (
          <div className="space-y-3 min-w-0">
            <div className="space-y-1.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${estStatusColors[estReq.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {estReq.status.replace('_', ' ')}
                </span>
                {estReq.dueBy && (
                  <span className="text-xs text-gray-400">Due {fmtDate(estReq.dueBy)}</span>
                )}
              </div>
              <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 items-baseline">
                <span className="text-xs text-gray-500 font-medium">Assigned to</span>
                <p className="font-medium text-gray-900 break-words">{estReq.assignee.name}</p>
                <span className="text-xs text-gray-500 font-medium">Requested by</span>
                <p className="text-gray-700 break-words">{estReq.requester.name}</p>
              </div>
            </div>

            {estRecord && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {[
                  { label: 'Raw estimate', value: `${estRecord.totalHoursRaw}h` },
                  { label: `After ${estRecord.bufferPct}% buffer`, value: `${estRecord.totalHoursFinal}h` },
                  { label: 'Rate', value: `$${estRecord.ratePerHour}/h` },
                  { label: 'Quoted price', value: fmtCurrency(estRecord.totalPriceFinal, estRecord.currency),
                    highlight: !!(lead.budget && estRecord.totalPriceFinal && estRecord.totalPriceFinal > lead.budget) },
                ].map(k => (
                  <div key={k.label} className={`p-2.5 sm:p-3 rounded-lg min-w-0 ${k.highlight ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="text-[10px] sm:text-xs text-gray-400 mb-0.5 leading-snug">{k.label}</div>
                    <div className={`text-sm sm:text-base font-semibold tabular-nums break-words ${k.highlight ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
                    {k.highlight && lead.budget != null && (
                      <div className="text-[10px] text-red-500 mt-0.5">Over budget {fmtCurrency(lead.budget, lead.currency)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {estRecord && (
              <div className="flex flex-wrap gap-2 text-xs">
                {estRecord.devConfirmedAt
                  ? <span className="inline-flex items-center rounded-md bg-green-50 text-green-800 px-2 py-1">✓ Dev confirmed</span>
                  : <span className="inline-flex items-center rounded-md bg-amber-50 text-amber-700 px-2 py-1">⏳ Awaiting dev</span>}
                {estRecord.bdApprovedAt
                  ? <span className="inline-flex items-center rounded-md bg-green-50 text-green-800 px-2 py-1">✓ BD approved</span>
                  : <span className="inline-flex items-center rounded-md bg-gray-50 text-gray-400 px-2 py-1">○ BD not approved</span>}
                {estRecord.bdRevisionNote && (
                  <span className="inline-flex items-center rounded-md bg-red-50 text-red-600 px-2 py-1">⚠ Revision requested</span>
                )}
              </div>
            )}

            {estRecord && estRecord.lines.length > 0 && (
              <p className="text-xs text-gray-400 leading-relaxed">
                {estRecord.lines.length} line item{estRecord.lines.length !== 1 ? 's' : ''} across {[...new Set(estRecord.lines.map(l => l.phase))].join(', ')}
                {estRecord.lines.some(l => l.riskFlag) && (
                  <span className="text-amber-600">
                    {' '}· {estRecord.lines.filter(l => l.riskFlag).length} risk flag{estRecord.lines.filter(l => l.riskFlag).length > 1 ? 's' : ''}
                  </span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Proposals */}
      <div className="card p-4 sm:p-5 mb-4 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Proposals & interactions</h2>
        </div>
        {lead.proposals.length === 0
          ? <p className="text-sm text-gray-400">No proposals logged yet.</p>
          : (
            <div className="space-y-3">
              {lead.proposals.map(p => (
                <div key={p.id} className="border border-gray-100 rounded-lg p-3 text-sm min-w-0">
                  <div className="flex flex-wrap justify-between gap-1 mb-1">
                    <span className="font-medium text-gray-800 break-words">Proposal by {p.writtenBy.name}</span>
                    <span className="text-gray-400 text-xs shrink-0">{fmtDate(p.sentAt)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-2 text-xs text-gray-500">
                    {p.budgetQuoted && <span>Quoted: {fmtCurrency(p.budgetQuoted, lead.currency)}</span>}
                    {p.techStack && <span className="break-words">Stack: {p.techStack}</span>}
                    {p.connectsSpent && <span>Connects: {p.connectsSpent}</span>}
                  </div>
                  {p.interviewNotes && (
                    <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800 break-words">
                      Interview notes: {p.interviewNotes}
                    </div>
                  )}
                  <span className={`badge mt-2 ${STATUS_COLORS[p.status]}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* Loss analysis */}
      {lead.status === 'lost' && (
        <div className="card p-4 sm:p-5 mb-4 min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Loss analysis</h2>
          {lead.lossAnalysis ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div><span className="label">Reason</span><p className="font-medium text-red-700">{lead.lossAnalysis.reason.replace(/_/g, ' ')}</p></div>
                <div><span className="label">Fault area</span><p className="font-medium text-gray-800">{lead.lossAnalysis.faultArea}</p></div>
              </div>
              {lead.lossAnalysis.competitorWon && <div><span className="label">Won by</span><p>{lead.lossAnalysis.competitorWon}</p></div>}
              {lead.lossAnalysis.notes && <div><span className="label">Notes</span><p className="text-gray-600 break-words">{lead.lossAnalysis.notes}</p></div>}
              {lead.lossAnalysis.lessonsLearned && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="label text-blue-600">Lessons learned</span>
                  <p className="text-blue-800 text-sm mt-1 break-words">{lead.lossAnalysis.lessonsLearned}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-600 font-medium">⚠️ No loss analysis recorded. This is required for every lost lead.</p>
          )}
        </div>
      )}

      {/* Audit Trail */}
      <EntityAuditTrail
        entityType="Lead"
        entityId={params.id}
        title="Lead Activity History"
      />

      <LeadActions lead={lead} members={members} />
    </div>
  )
}
