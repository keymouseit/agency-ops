import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, STATUS_COLORS } from '@/lib/utils'
import Link from 'next/link'
import AddProjectForm from './AddProjectForm'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  scoping: 'Scoping', active: 'Active', qa: 'QA', delivered: 'Delivered', cancelled: 'Cancelled',
}

export default async function ProjectsPage() {
  const [projects, members, leads] = await Promise.all([
    prisma.project.findMany({
      include: {
        owner: true,
        checkIns: { orderBy: { weekOf: 'desc' }, take: 1 },
        scopeChanges: true,
        milestones: true,
        postMortem: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.lead.findMany({ where: { status: 'won', project: null }, select: { id: true, clientName: true } }),
  ])

  const active = projects.filter(p => ['active', 'qa', 'scoping'].includes(p.status))
  const delivered = projects.filter(p => p.status === 'delivered')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full lifecycle — scoping to delivery. Every scope change logged.</p>
        </div>
        <AddProjectForm members={members} wonLeads={leads} />
      </div>

      {/* Unsigned scope changes alert */}
      {projects.some(p => p.scopeChanges.some(s => !s.changeOrderSigned)) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800 font-medium">
          ⚠️ {projects.reduce((n, p) => n + p.scopeChanges.filter(s => !s.changeOrderSigned).length, 0)} scope change(s) missing signed change order — action required.
        </div>
      )}

      {/* Active projects */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Active ({active.length})</h2>
      <div className="space-y-3 mb-8">
        {active.map(p => {
          const ci = p.checkIns[0]
          const pct = ci?.progressPct ?? 0
          const onTrack = ci?.onTrack ?? 'yes'
          const unsigned = p.scopeChanges.filter(s => !s.changeOrderSigned).length
          const overdue = p.estimatedEnd && new Date(p.estimatedEnd) < new Date() && p.status !== 'delivered'
          const estAccuracy = p.actualHours && p.estimatedHours
            ? Math.round((p.actualHours / p.estimatedHours) * 100)
            : null

          return (
            <div key={p.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <Link href={`/projects/${p.id}`} className="text-base font-semibold text-gray-900 hover:underline">{p.name}</Link>
                    <span className={`badge ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                    {unsigned > 0 && <span className="badge bg-red-100 text-red-800">{unsigned} CO missing</span>}
                    {overdue && <span className="badge bg-red-100 text-red-800">Overdue</span>}
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mb-3">
                    <span>Owner: {p.owner.name}</span>
                    {p.contractValue && <span>Value: {fmtCurrency(p.contractValue, p.currency)}</span>}
                    {p.estimatedEnd && <span>Due: {fmtDate(p.estimatedEnd)}</span>}
                    {estAccuracy && <span className={estAccuracy > 120 ? 'text-red-500' : 'text-gray-400'}>Est. usage: {estAccuracy}%</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 max-w-xs h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${onTrack === 'yes' ? 'bg-green-500' : onTrack === 'at_risk' ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{pct}% complete</span>
                  </div>
                  {ci?.blockers && <p className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">Blocker: {ci.blockers}</p>}
                </div>
                <Link href={`/projects/${p.id}`} className="text-xs text-gray-400 hover:text-gray-700 ml-4">Details →</Link>
              </div>
            </div>
          )
        })}
        {active.length === 0 && <div className="card p-8 text-center text-gray-400 text-sm">No active projects.</div>}
      </div>

      {/* Delivered */}
      {delivered.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Delivered ({delivered.length})</h2>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-left px-4 py-3 font-medium">Owner</th>
                  <th className="text-left px-4 py-3 font-medium">Value</th>
                  <th className="text-left px-4 py-3 font-medium">On time?</th>
                  <th className="text-left px-4 py-3 font-medium">Client score</th>
                  <th className="text-left px-4 py-3 font-medium">Est. accuracy</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {delivered.map(p => {
                  const acc = p.actualHours && p.estimatedHours
                    ? Math.round((p.actualHours / p.estimatedHours) * 100)
                    : null
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500">{p.owner.name}</td>
                      <td className="px-4 py-3">{fmtCurrency(p.contractValue, p.currency)}</td>
                      <td className="px-4 py-3">
                        {p.onTime == null ? '—' : p.onTime
                          ? <span className="badge bg-green-100 text-green-800">Yes</span>
                          : <span className="badge bg-red-100 text-red-800">Late</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.clientScore
                          ? <span className={p.clientScore >= 8 ? 'text-green-700 font-semibold' : p.clientScore >= 6 ? 'text-amber-700 font-semibold' : 'text-red-600 font-semibold'}>{p.clientScore}/10</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {acc
                          ? <span className={acc > 120 ? 'text-red-600 font-semibold' : 'text-green-700'}>{acc}%</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/projects/${p.id}`} className="text-xs text-gray-400 hover:text-gray-700 underline">View</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
