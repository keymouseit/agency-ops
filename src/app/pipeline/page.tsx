import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, STATUS_COLORS } from '@/lib/utils'
import Link from 'next/link'
import AddLeadForm from './AddLeadForm'
import { startOfDay, differenceInDays } from 'date-fns'
import { getActiveMembersCached } from '@/lib/active-members'

export const revalidate = 30

const STAGES = ['new', 'proposal_sent', 'interview', 'won', 'lost'] as const
const STAGE_LABELS: Record<string, string> = {
  new: 'New lead', proposal_sent: 'Proposal sent', interview: 'Interview / Shortlisted', won: 'Won', lost: 'Lost',
}

export default async function PipelinePage({ searchParams }: { searchParams: { status?: string } }) {
  const [leads, members] = await Promise.all([
    prisma.lead.findMany({
      where: searchParams.status ? { status: searchParams.status } : {},
      include: { owner: true, proposals: { orderBy: { sentAt: 'desc' }, take: 1 }, lossAnalysis: true },
      orderBy: { createdAt: 'desc' },
    }),
    getActiveMembersCached(),
  ])

  const today = startOfDay(new Date())

  const totalByStage = STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">BD Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Every lead, every stage, every outcome — with owner accountability.</p>
        </div>
        <AddLeadForm members={members} />
      </div>

      {/* Stage summary */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        {STAGES.map(s => (
          <Link key={s} href={`/pipeline?status=${s}`} className={`card p-4 text-center hover:shadow-md transition-shadow ${searchParams.status === s ? 'ring-2 ring-gray-900' : ''}`}>
            <div className="text-xl font-bold text-gray-900">{totalByStage[s]}</div>
            <div className="text-xs text-gray-500 mt-0.5">{STAGE_LABELS[s]}</div>
          </Link>
        ))}
      </div>

      {/* Lead list */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Source</th>
              <th className="text-left px-4 py-3 font-medium">Owner</th>
              <th className="text-left px-4 py-3 font-medium">Budget</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Last updated</th>
              <th className="text-left px-4 py-3 font-medium">Loss reason</th>
              <th className="text-left px-4 py-3 font-medium">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map(l => {
              const daysSince = differenceInDays(today, new Date(l.updatedAt))
              const stale = daysSince >= 5 && ['new', 'proposal_sent', 'interview'].includes(l.status)
              return (
                <tr key={l.id} className={`hover:bg-gray-50 transition-colors ${stale ? 'bg-amber-50' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{l.clientName}</td>
                  <td className="px-4 py-3 text-gray-600">{l.source}</td>
                  <td className="px-4 py-3 text-gray-600">{l.owner.name}</td>
                  <td className="px-4 py-3 text-gray-800">{fmtCurrency(l.budget, l.currency)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[l.status]}`}>{STAGE_LABELS[l.status]}</span>
                  </td>
                  <td className="px-4 py-3">
                    {stale ? (
                      <span className="text-xs text-amber-700 font-medium">No update in {daysSince}d</span>
                    ) : (
                      <span className="text-xs text-gray-400">{fmtDate(l.updatedAt)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {l.lossAnalysis
                      ? <span className="text-red-600 font-medium">{l.lossAnalysis.reason.replace(/_/g, ' ')}</span>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/pipeline/${l.id}`} className="text-xs text-gray-400 hover:text-gray-700 underline">View</Link>
                  </td>
                </tr>
              )
            })}
            {leads.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">No leads found. Add your first lead.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
