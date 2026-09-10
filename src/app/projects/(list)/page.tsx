import { fmtCurrency } from '@/lib/utils'
import AddProjectForm from '../AddProjectForm'
import ProjectContractsBoard from '../ProjectContractsBoard'
import { auth } from '@/lib/auth'
import { getBranding } from '@/lib/branding'
import { getActiveMembersCached } from '@/lib/active-members'
import { getProjectListCached } from '@/lib/project-list'
import { prisma } from '@/lib/prisma'

/** Auth pages are dynamic; list data is short-cached (30s) via getProjectListCached. */
export const revalidate = 30

export default async function ProjectsPage() {
  const session = await auth()
  const userRole = session?.user?.role
  const userId = session?.user?.id
  const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
  const isDev = userRole === 'Dev'

  const [projects, members, leads, branding] = await Promise.all([
    getProjectListCached(isDev ? userId : undefined),
    getActiveMembersCached(),
    prisma.lead.findMany({ where: { status: 'won', project: null }, select: { id: true, clientName: true } }),
    getBranding(),
  ])

  const active = projects.filter(p => ['active', 'qa', 'scoping'].includes(p.status))
  const onHold = projects.filter(p => p.status === 'on_hold')
  const maintenance = projects.filter(p => p.status === 'maintenance')
  const delivered = projects.filter(p => p.status === 'delivered')
  const unsignedCount = projects.reduce(
    (n, p) => n + p.scopeChanges.filter(s => !s.changeOrderSigned).length,
    0
  )
  const activeValue = active.reduce((n, p) => n + (p.contractValue || 0), 0)

  const sections = [
    { id: 'active', title: 'Active', projects: active },
    { id: 'on_hold', title: 'On hold', projects: onHold },
    { id: 'maintenance', title: 'Maintenance', projects: maintenance },
    { id: 'delivered', title: 'Delivered', projects: delivered },
  ]

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">Projects</h1>
          {isBD ? (
            <p className="text-sm text-gray-600 mt-2">
              Value in progress:{' '}
              <span className="font-medium text-green-700">{fmtCurrency(activeValue)}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-2">
              {active.length} active · {delivered.length} delivered
            </p>
          )}
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

      {unsignedCount > 0 && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">{unsignedCount} scope change(s)</span> missing signed change order.
        </div>
      )}

      <ProjectContractsBoard sections={sections} companyName={branding.name} />
    </div>
  )
}
