import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/utils'
import Link from 'next/link'
import AddProjectForm from './AddProjectForm'
import ProjectListCard from './ProjectListCard'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const session = await auth()
  const userRole = session?.user?.role
  const userId = session?.user?.id
  const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
  const isDev = userRole === 'Dev'

  const [projects, members, leads] = await Promise.all([
    prisma.project.findMany({
      where: isDev ? { developerId: userId } : undefined,
      select: {
        id: true,
        name: true,
        status: true,
        contractValue: true,
        currency: true,
        estimatedEnd: true,
        actualHours: true,
        estimatedHours: true,
        onTime: true,
        clientScore: true,
        developer: { select: { name: true } },
        bdMember: { select: { name: true } },
        checkIns: {
          orderBy: { weekOf: 'desc' },
          take: 1,
          select: { onTrack: true, blockers: true, progressPct: true },
        },
        scopeChanges: { select: { changeOrderSigned: true } },
        milestones: { select: { status: true } },
        releaseSignOff: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, role: true },
    }),
    prisma.lead.findMany({ where: { status: 'won', project: null }, select: { id: true, clientName: true } }),
  ])

  const active = projects.filter(p => ['active', 'qa', 'scoping'].includes(p.status))
  const onHold = projects.filter(p => p.status === 'on_hold')
  const maintenance = projects.filter(p => p.status === 'maintenance')
  const delivered = projects.filter(p => p.status === 'delivered')
  const unsignedCount = projects.reduce(
    (n, p) => n + p.scopeChanges.filter(s => !s.changeOrderSigned).length,
    0
  )
  const totalMilestones = active.reduce((n, p) => n + p.milestones.length, 0)
  const doneMilestones = active.reduce(
    (n, p) => n + p.milestones.filter(m => m.status === 'done').length,
    0
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 px-4 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-lg text-white shrink-0">
              📁
            </span>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Projects</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Full lifecycle — scoping to delivery. Every scope change logged.
              </p>
            </div>
          </div>
          {!isDev && (
            <AddProjectForm
              members={members}
              wonLeads={leads}
              currentUserId={userId}
              currentUserRole={userRole}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active', value: active.length.toString(), icon: '🚀' },
          { label: 'Delivered', value: delivered.length.toString(), icon: '✅' },
          {
            label: 'Milestones done',
            value: totalMilestones > 0 ? `${doneMilestones}/${totalMilestones}` : '—',
            icon: '🎯',
          },
          {
            label: 'CO missing',
            value: unsignedCount.toString(),
            icon: '⚠️',
            bad: unsignedCount > 0,
          },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{stat.label}</span>
              <span className="text-base opacity-80" aria-hidden>
                {stat.icon}
              </span>
            </div>
            <div className={`text-xl font-semibold ${stat.bad ? 'text-red-600' : 'text-gray-900'}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {unsignedCount > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
          <span aria-hidden>⚠️</span>
          <span>
            <span className="font-semibold">{unsignedCount} scope change(s)</span> missing signed change order —
            action required.
          </span>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Active projects</h2>
          <span className="badge bg-gray-100 text-gray-600 text-[11px]">{active.length}</span>
        </div>
        <div className="space-y-3">
          {active.map(p => (
            <ProjectListCard key={p.id} project={p} showValue={!!isBD} />
          ))}
          {active.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xl">
                📁
              </div>
              <p className="text-sm font-medium text-gray-700">No active projects</p>
              <p className="text-xs text-gray-400 mt-1">Projects in scoping, active, or QA will appear here.</p>
            </div>
          )}
        </div>
      </section>

      {onHold.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">On Hold</h2>
            <span className="badge bg-amber-100 text-amber-800 text-[11px]">{onHold.length}</span>
          </div>
          <div className="space-y-3">
            {onHold.map(p => (
              <ProjectListCard key={p.id} project={p} showValue={!!isBD} />
            ))}
          </div>
        </section>
      )}

      {maintenance.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Maintenance</h2>
            <span className="badge bg-cyan-100 text-cyan-800 text-[11px]">{maintenance.length}</span>
          </div>
          <div className="space-y-3">
            {maintenance.map(p => (
              <ProjectListCard key={p.id} project={p} showValue={!!isBD} />
            ))}
          </div>
        </section>
      )}

      {delivered.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Delivered</h2>
            <span className="badge bg-green-100 text-green-700 text-[11px]">{delivered.length}</span>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-100">
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Project</th>
                    <th className="text-left px-4 py-3 font-semibold">Developer</th>
                    <th className="text-left px-4 py-3 font-semibold">BD</th>
                    {isBD && <th className="text-left px-4 py-3 font-semibold">Value</th>}
                    <th className="text-left px-4 py-3 font-semibold">On time</th>
                    <th className="text-left px-4 py-3 font-semibold">Client score</th>
                    <th className="text-left px-4 py-3 font-semibold">Est. accuracy</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {delivered.map(p => {
                    const acc =
                      p.actualHours && p.estimatedHours
                        ? Math.round((p.actualHours / p.estimatedHours) * 100)
                        : null
                    return (
                      <tr key={p.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={`/projects/${p.id}`}
                            className="font-medium text-gray-900 hover:text-gray-700"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{p.developer.name}</td>
                        <td className="px-4 py-3 text-gray-500">{p.bdMember?.name || '—'}</td>
                        {isBD && (
                          <td className="px-4 py-3 text-gray-700">
                            {fmtCurrency(p.contractValue, p.currency)}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {p.onTime == null ? (
                            '—'
                          ) : p.onTime ? (
                            <span className="badge bg-green-100 text-green-800 text-[11px]">Yes</span>
                          ) : (
                            <span className="badge bg-red-100 text-red-800 text-[11px]">Late</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {p.clientScore ? (
                            <span
                              className={
                                p.clientScore >= 8
                                  ? 'text-green-700 font-semibold'
                                  : p.clientScore >= 6
                                    ? 'text-amber-700 font-semibold'
                                    : 'text-red-600 font-semibold'
                              }
                            >
                              {p.clientScore}/10
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {acc ? (
                            <span className={acc > 120 ? 'text-red-600 font-semibold' : 'text-green-700'}>
                              {acc}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/projects/${p.id}`}
                            className="text-xs font-medium text-gray-500 hover:text-gray-900"
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
