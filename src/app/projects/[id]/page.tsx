import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, STATUS_COLORS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import ProjectActions from './ProjectActions'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  scoping: 'Scoping', active: 'Active', qa: 'QA', delivered: 'Delivered', cancelled: 'Cancelled',
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const userRole = session?.user?.role
  const userId = session?.user?.id
  const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
  const isDev = userRole === 'Dev'

  const [project, members] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      include: {
        owner: true,
        lead: { select: { id: true, clientName: true, source: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        scopeChanges: { include: { approvedBy: true }, orderBy: { createdAt: 'desc' } },
        checkIns: { include: { submittedBy: true }, orderBy: { weekOf: 'desc' }, take: 8 },
        postMortem: true,
      },
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  if (!project) notFound()

  // Developers can only see their own projects
  if (isDev && project.ownerId !== userId) notFound()

  const estAccuracy = project.actualHours && project.estimatedHours
    ? Math.round((project.actualHours / project.estimatedHours) * 100)
    : null
  const totalScopeHours = project.scopeChanges.reduce((s, c) => s + (c.hoursAdded || 0), 0)
  const unsignedCOs = project.scopeChanges.filter(s => !s.changeOrderSigned)

  return (
    <div className="max-w-4xl">
      <div className="text-xs text-gray-400 mb-2">← <a href="/projects" className="hover:text-gray-700">Projects</a></div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
            <span className={`badge ${STATUS_COLORS[project.status]}`}>{STATUS_LABELS[project.status]}</span>
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>Owner: {project.owner.name}</span>
            {project.clientName && <span>Client: {project.clientName}</span>}
            {project.contractValue && isBD && <span>Value: {fmtCurrency(project.contractValue, project.currency)}</span>}
            {project.lead && <span>Source: {project.lead.source}</span>}
          </div>
        </div>
      </div>

      {unsignedCOs.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800">
          ⚠️ {unsignedCOs.length} scope change(s) without a signed change order. Do not proceed with this work until signed.
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Estimated hours', value: project.estimatedHours?.toString() ?? '—' },
          { label: 'Actual hours', value: project.actualHours?.toString() ?? '—' },
          { label: 'Est. accuracy', value: estAccuracy ? `${estAccuracy}%` : '—', danger: estAccuracy != null && estAccuracy > 120 },
          { label: 'Scope drift (hrs)', value: totalScopeHours > 0 ? `+${totalScopeHours}h` : '0h', danger: totalScopeHours > 20 },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</div>
            <div className={`text-xl font-semibold ${s.danger ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Milestones */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Milestones</h2>
          {project.milestones.length === 0
            ? <p className="text-sm text-gray-400">No milestones added.</p>
            : (
              <div className="space-y-2">
                {project.milestones.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      m.status === 'done' ? 'bg-green-500' :
                      m.status === 'missed' ? 'bg-red-500' :
                      m.status === 'at_risk' ? 'bg-amber-400' : 'bg-gray-300'
                    }`} />
                    <span className={`flex-1 ${m.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{m.title}</span>
                    <span className="text-xs text-gray-400">{fmtDate(m.dueDate)}</span>
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Scope changes */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Scope changes ({project.scopeChanges.length})</h2>
          {project.scopeChanges.length === 0
            ? <p className="text-sm text-gray-400">No scope changes. Good.</p>
            : (
              <div className="space-y-2">
                {project.scopeChanges.map(sc => (
                  <div key={sc.id} className={`p-2 rounded text-xs ${!sc.changeOrderSigned ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-700 flex-1">{sc.description}</span>
                      <span className={`badge flex-shrink-0 ${sc.changeOrderSigned ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {sc.changeOrderSigned ? 'CO signed' : 'NO CO'}
                      </span>
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {sc.hoursAdded ? `+${sc.hoursAdded}h` : ''} {sc.valueAdded && isBD ? `· +${fmtCurrency(sc.valueAdded)}` : ''} · {fmtDate(sc.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Recent check-ins */}
      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Weekly check-ins</h2>
        {project.checkIns.length === 0
          ? <p className="text-sm text-gray-400">No check-ins submitted yet.</p>
          : (
            <div className="space-y-2">
              {project.checkIns.map(ci => (
                <div key={ci.id} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0 text-sm">
                  <span className="text-gray-400 text-xs w-24 flex-shrink-0">{fmtDate(ci.weekOf)}</span>
                  <span className="font-medium text-gray-700 w-8">{ci.progressPct}%</span>
                  <span className={`badge text-xs ${STATUS_COLORS[ci.onTrack]}`}>{ci.onTrack.replace('_', ' ')}</span>
                  <span className="text-gray-400 text-xs">{ci.submittedBy.name}</span>
                  {ci.blockers && <span className="text-amber-700 text-xs flex-1 truncate">⚠ {ci.blockers}</span>}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Post-mortem */}
      {project.postMortem && (
        <div className="card p-5 mb-4 bg-blue-50 border-blue-100">
          <h2 className="text-sm font-semibold text-blue-900 mb-3">Post-mortem</h2>
          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
            <div><span className="label">Est. accuracy</span><span className={project.postMortem.estimationAccuracy && project.postMortem.estimationAccuracy > 1.2 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>
              {project.postMortem.estimationAccuracy ? `${Math.round(project.postMortem.estimationAccuracy * 100)}%` : '—'}
            </span></div>
            <div><span className="label">Client satisfaction</span><span className="font-semibold">{project.postMortem.clientSatisfaction ?? '—'}/10</span></div>
          </div>
          {project.postMortem.whatBroke && <div className="mb-2"><span className="label text-red-600">What broke</span><p className="text-red-800 text-sm">{project.postMortem.whatBroke}</p></div>}
          {project.postMortem.whatWorked && <div className="mb-2"><span className="label text-green-700">What worked</span><p className="text-green-800 text-sm">{project.postMortem.whatWorked}</p></div>}
          {project.postMortem.preventionAction && <div><span className="label text-blue-700">Action items</span><p className="text-blue-800 text-sm">{project.postMortem.preventionAction}</p></div>}
        </div>
      )}

      <ProjectActions project={project} members={members} />
    </div>
  )
}
