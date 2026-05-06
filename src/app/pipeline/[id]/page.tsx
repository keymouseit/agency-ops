import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, LOSS_REASONS, FAULT_AREAS, STATUS_COLORS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import LeadActions from './LeadActions'
import Link from 'next/link'

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
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs text-gray-400 mb-1">← <a href="/pipeline" className="hover:text-gray-700">Pipeline</a></div>
          <h1 className="text-2xl font-semibold text-gray-900">{lead.clientName}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>{lead.source}</span>
            <span>·</span>
            <span>Owner: {lead.owner.name}</span>
            <span>·</span>
            <span>{fmtCurrency(lead.budget, lead.currency)}</span>
            <span className={`badge ${STATUS_COLORS[lead.status]}`}>{STAGE_LABELS[lead.status]}</span>
          </div>
          {lead.description && <p className="mt-2 text-sm text-gray-600 max-w-xl">{lead.description}</p>}
        </div>
      </div>

      {/* Link to project if won */}
      {lead.project && (
        <div className="card p-4 mb-4 flex items-center justify-between bg-green-50 border-green-100">
          <span className="text-sm font-medium text-green-800">Converted to project: {lead.project.name}</span>
          <a href={`/projects/${lead.project.id}`} className="text-xs text-green-700 underline">View project →</a>
        </div>
      )}

      {/* Estimation block */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Estimation</h2>
          <Link href={`/estimate/${lead.id}`} className="btn-primary text-xs">
            {estReq ? 'Open estimation →' : '+ Request estimate'}
          </Link>
        </div>

        {!estReq ? (
          <p className="text-sm text-amber-600">
            No estimation started. BD should request an estimate from a developer before sending any proposal.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className={`badge ${estStatusColors[estReq.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {estReq.status.replace('_', ' ')}
              </span>
              <span className="text-gray-500">Assigned to: <strong>{estReq.assignee.name}</strong></span>
              <span className="text-gray-500">Requested by: {estReq.requester.name}</span>
              {estReq.dueBy && <span className="text-gray-400 text-xs">Due: {fmtDate(estReq.dueBy)}</span>}
            </div>

            {estRecord && (
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Raw estimate', value: `${estRecord.totalHoursRaw}h` },
                  { label: `After ${estRecord.bufferPct}% buffer`, value: `${estRecord.totalHoursFinal}h` },
                  { label: 'Rate', value: `$${estRecord.ratePerHour}/h` },
                  { label: 'Quoted price', value: fmtCurrency(estRecord.totalPriceFinal, estRecord.currency),
                    highlight: !!(lead.budget && estRecord.totalPriceFinal && estRecord.totalPriceFinal > lead.budget) },
                ].map(k => (
                  <div key={k.label} className={`p-3 rounded-lg ${k.highlight ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className="text-xs text-gray-400 mb-0.5">{k.label}</div>
                    <div className={`font-semibold ${k.highlight ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</div>
                  </div>
                ))}
              </div>
            )}

            {estRecord && (
              <div className="flex gap-3 text-xs text-gray-500">
                {estRecord.devConfirmedAt
                  ? <span className="text-green-700">✓ Developer confirmed</span>
                  : <span className="text-amber-600">⏳ Awaiting developer confirmation</span>}
                {estRecord.bdApprovedAt
                  ? <span className="text-green-700">✓ BD approved</span>
                  : <span className="text-gray-400">○ BD not yet approved</span>}
                {estRecord.bdRevisionNote && (
                  <span className="text-red-600">⚠ Revision requested</span>
                )}
              </div>
            )}

            {estRecord && estRecord.lines.length > 0 && (
              <div className="text-xs text-gray-400">
                {estRecord.lines.length} line item{estRecord.lines.length !== 1 ? 's' : ''} across {[...new Set(estRecord.lines.map(l => l.phase))].join(', ')}
                {estRecord.lines.some(l => l.riskFlag) && (
                  <span className="ml-2 text-amber-600">· {estRecord.lines.filter(l => l.riskFlag).length} risk flag{estRecord.lines.filter(l => l.riskFlag).length > 1 ? 's' : ''}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Proposals */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Proposals & interactions</h2>
        </div>
        {lead.proposals.length === 0
          ? <p className="text-sm text-gray-400">No proposals logged yet.</p>
          : (
            <div className="space-y-3">
              {lead.proposals.map(p => (
                <div key={p.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-800">Proposal by {p.writtenBy.name}</span>
                    <span className="text-gray-400 text-xs">{fmtDate(p.sentAt)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                    {p.budgetQuoted && <span>Quoted: {fmtCurrency(p.budgetQuoted)}</span>}
                    {p.techStack && <span>Stack: {p.techStack}</span>}
                    {p.connectsSpent && <span>Connects: {p.connectsSpent}</span>}
                  </div>
                  {p.interviewNotes && (
                    <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
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
        <div className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Loss analysis</h2>
          {lead.lossAnalysis ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="label">Reason</span><p className="font-medium text-red-700">{lead.lossAnalysis.reason.replace(/_/g, ' ')}</p></div>
                <div><span className="label">Fault area</span><p className="font-medium text-gray-800">{lead.lossAnalysis.faultArea}</p></div>
              </div>
              {lead.lossAnalysis.competitorWon && <div><span className="label">Won by</span><p>{lead.lossAnalysis.competitorWon}</p></div>}
              {lead.lossAnalysis.notes && <div><span className="label">Notes</span><p className="text-gray-600">{lead.lossAnalysis.notes}</p></div>}
              {lead.lossAnalysis.lessonsLearned && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <span className="label text-blue-600">Lessons learned</span>
                  <p className="text-blue-800 text-sm mt-1">{lead.lossAnalysis.lessonsLearned}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-amber-600 font-medium">⚠️ No loss analysis recorded. This is required for every lost lead.</p>
          )}
        </div>
      )}

      <LeadActions lead={lead} members={members} />
    </div>
  )
}
