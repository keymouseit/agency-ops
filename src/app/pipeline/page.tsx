import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, STATUS_COLORS } from '@/lib/utils'
import Link from 'next/link'
import AddLeadForm from './AddLeadForm'
import { startOfDay, differenceInDays } from 'date-fns'
import { getActiveMembersCached } from '@/lib/active-members'

export const revalidate = 30

const STAGES = ['new', 'proposal_sent', 'interview', 'won', 'lost'] as const
const STAGE_LABELS: Record<string, string> = {
  new: 'New lead',
  proposal_sent: 'Proposal sent',
  interview: 'Interview / Shortlisted',
  won: 'Won',
  lost: 'Lost',
}
const STAGE_SHORT: Record<string, string> = {
  new: 'New',
  proposal_sent: 'Proposal',
  interview: 'Interview',
  won: 'Won',
  lost: 'Lost',
}

export default async function PipelinePage({ searchParams }: { searchParams: { status?: string } }) {
  const [allLeads, members] = await Promise.all([
    prisma.lead.findMany({
      include: { owner: true, proposals: { orderBy: { sentAt: 'desc' }, take: 1 }, lossAnalysis: true },
      orderBy: { createdAt: 'desc' },
    }),
    getActiveMembersCached(),
  ])

  const today = startOfDay(new Date())

  const totalByStage = STAGES.reduce((acc, s) => {
    acc[s] = allLeads.filter(l => l.status === s).length
    return acc
  }, {} as Record<string, number>)

  const leads = searchParams.status
    ? allLeads.filter(l => l.status === searchParams.status)
    : allLeads

  return (
    <div className="min-w-0 w-full">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">BD Pipeline</h1>
          <p className="hidden sm:block text-sm text-gray-500 mt-0.5">
            Every lead, every stage, every outcome — with owner accountability.
          </p>
        </div>
        <div className="shrink-0 pt-0.5">
          <AddLeadForm members={members} />
        </div>
      </div>

      {/* Stage KPIs — 3 per row */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Link
          href="/pipeline"
          className={`rounded-xl border px-2 py-2.5 text-center transition-colors min-w-0 ${
            !searchParams.status
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`text-lg font-bold tabular-nums ${!searchParams.status ? 'text-white' : 'text-gray-900'}`}>
            {allLeads.length}
          </div>
          <div
            className={`text-[10px] font-medium mt-0.5 truncate ${
              !searchParams.status ? 'text-white/70' : 'text-gray-500'
            }`}
          >
            All
          </div>
        </Link>
        {STAGES.map(s => {
          const active = searchParams.status === s
          return (
            <Link
              key={s}
              href={`/pipeline?status=${s}`}
              className={`rounded-xl border px-2 py-2.5 text-center transition-colors min-w-0 ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className={`text-lg font-bold tabular-nums ${active ? 'text-white' : 'text-gray-900'}`}>
                {totalByStage[s]}
              </div>
              <div
                className={`text-[10px] font-medium mt-0.5 truncate ${
                  active ? 'text-white/70' : 'text-gray-500'
                }`}
              >
                {STAGE_SHORT[s]}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {leads.length === 0 ? (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-12 text-center text-sm text-gray-400">
            No leads found. Add your first lead.
          </div>
        ) : (
          leads.map(l => {
            const daysSince = differenceInDays(today, new Date(l.updatedAt))
            const stale = daysSince >= 5 && ['new', 'proposal_sent', 'interview'].includes(l.status)
            return (
              <Link
                key={l.id}
                href={`/pipeline/${l.id}`}
                className={`block rounded-xl border px-3.5 py-3 transition-colors active:bg-gray-50 ${
                  stale ? 'border-amber-200 bg-amber-50/80' : 'border-gray-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{l.clientName}</p>
                  <span className={`badge shrink-0 ${STATUS_COLORS[l.status]}`}>
                    {STAGE_SHORT[l.status] ?? l.status}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                  <span>{l.source}</span>
                  <span className="text-gray-700">{l.owner.name}</span>
                  <span className="tabular-nums text-gray-800">{fmtCurrency(l.budget, l.currency)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                  {stale ? (
                    <span className="font-medium text-amber-700">No update in {daysSince}d</span>
                  ) : (
                    <span className="text-gray-400">Updated {fmtDate(l.updatedAt)}</span>
                  )}
                  {l.lossAnalysis ? (
                    <span className="font-medium text-red-600">
                      {l.lossAnalysis.reason.replace(/_/g, ' ')}
                    </span>
                  ) : null}
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
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
                    {l.lossAnalysis ? (
                      <span className="text-red-600 font-medium">{l.lossAnalysis.reason.replace(/_/g, ' ')}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/pipeline/${l.id}`} className="text-xs text-gray-400 hover:text-gray-700 underline">
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
            {leads.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400 text-sm">
                  No leads found. Add your first lead.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
