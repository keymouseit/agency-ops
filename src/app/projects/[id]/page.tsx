import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, STATUS_COLORS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import ProjectActions from './ProjectActions'
import { auth } from '@/lib/auth'
import EntityAuditTrail from '@/components/EntityAuditTrail'
import DeveloperMilestones from './DeveloperMilestones'
import QAReadyPrompt from './QAReadyPrompt'
import ScopeChangesCard from './ScopeChangesCard'
import DeleteProjectButton from './DeleteProjectButton'
import QASignOffStatus, { QASignOffBadge } from '@/components/QASignOffStatus'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  scoping: 'Scoping', active: 'Active', qa: 'QA', delivered: 'Delivered', cancelled: 'Cancelled',
}

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const userRole = session?.user?.role
  const userId = session?.user?.id
  const isFounder = userRole === 'Founder'
  const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
  const isDev = userRole === 'Dev'

  const [project, members] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      include: {
        developer: true,
        bdMember: true,
        lead: { select: { id: true, clientName: true, source: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        scopeChanges: { include: { approvedBy: true }, orderBy: { createdAt: 'desc' } },
        checkIns: { include: { submittedBy: true }, orderBy: { weekOf: 'desc' }, take: 8 },
        postMortem: true,
        releaseSignOff: { include: { signedOffBy: true } },
        testCycles: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
  ])

  if (!project) notFound()

  // Developers can only see their own projects
  if (isDev && project.developerId !== userId) notFound()

  const estAccuracy = project.actualHours && project.estimatedHours
    ? Math.round((project.actualHours / project.estimatedHours) * 100)
    : null
  const activeScopeChanges = project.scopeChanges.filter(s => s.approvalStatus !== 'declined')
  const totalScopeHours = activeScopeChanges.reduce((s, c) => s + (c.hoursAdded || 0), 0)
  const unsignedCOs = activeScopeChanges.filter(s => !s.changeOrderSigned)

  // Calculate progress based on milestone completion
  const totalMilestones = project.milestones.length
  const completedMilestones = project.milestones.filter(m => m.status === 'done').length
  const calculatedProgress = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0

  // Check if all milestones are ready for QA but project status is not QA
  const allMilestonesReadyForQA = totalMilestones > 0 &&
    project.milestones.every(m => m.status === 'ready_for_qa' || m.status === 'done')
  const showQAPrompt = allMilestonesReadyForQA &&
    project.status !== 'qa' &&
    project.status !== 'delivered' &&
    project.status !== 'cancelled' &&
    (userRole === 'Dev' || userRole === 'Founder' || userRole === 'Both')

  return (
    <div className="max-w-4xl">
      <div className="text-xs text-gray-400 mb-2">← <a href="/projects" className="hover:text-gray-700">Projects</a></div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
            <span className={`badge ${STATUS_COLORS[project.status]}`}>{STATUS_LABELS[project.status]}</span>
            {project.releaseSignOff && <QASignOffBadge signed />}
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>Developer: {project.developer.name}</span>
            {project.bdMember && <span>BD: {project.bdMember.name}</span>}
            {project.clientName && <span>Client: {project.clientName}</span>}
            {project.contractValue && isBD && <span>Value: {fmtCurrency(project.contractValue, project.currency)}</span>}
            {project.lead && <span>Source: {project.lead.source}</span>}
          </div>
        </div>
        {isFounder && (
          <DeleteProjectButton projectId={project.id} projectName={project.name} />
        )}
      </div>

      {unsignedCOs.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800">
          ⚠️ {unsignedCOs.length} scope change(s) without a signed change order. Do not proceed with this work until signed.
        </div>
      )}

      {/* Smart prompt to move project to QA when all milestones are ready */}
      {showQAPrompt && (
        <QAReadyPrompt projectId={project.id} projectName={project.name} />
      )}

      <QASignOffStatus
        projectId={project.id}
        projectStatus={project.status}
        signOff={project.releaseSignOff}
        latestCycle={project.testCycles[0] ?? null}
        showQALink={userRole === 'QA' || userRole === 'Founder'}
      />

      {/* Overall Progress */}
      {totalMilestones > 0 && (
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Overall Progress</h2>
            <span className={`text-lg font-bold ${
              calculatedProgress >= 80 ? 'text-green-600' :
              calculatedProgress >= 50 ? 'text-amber-600' :
              calculatedProgress >= 25 ? 'text-blue-600' :
              'text-gray-500'
            }`}>
              {calculatedProgress}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${
                calculatedProgress >= 80 ? 'bg-green-500' :
                calculatedProgress >= 50 ? 'bg-amber-400' :
                calculatedProgress >= 25 ? 'bg-blue-500' :
                'bg-gray-400'
              }`}
              style={{ width: `${calculatedProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {completedMilestones} of {totalMilestones} milestones completed
          </p>
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
          <DeveloperMilestones milestones={project.milestones} projectId={project.id} />
        </div>

        <ScopeChangesCard
          projectId={project.id}
          bdMemberId={project.bdMemberId}
          currentUserId={userId}
          userRole={userRole}
          canViewValue={!!isBD}
          scopeChanges={project.scopeChanges.map(sc => ({
            id: sc.id,
            description: sc.description,
            hoursAdded: sc.hoursAdded,
            valueAdded: sc.valueAdded,
            changeOrderSigned: sc.changeOrderSigned,
            approvalStatus: sc.approvalStatus,
            decisionNote: sc.decisionNote,
            createdAt: sc.createdAt.toISOString(),
            approvedBy: sc.approvedBy ? { name: sc.approvedBy.name } : null,
          }))}
        />
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

      {/* Audit Trail */}
      <EntityAuditTrail
        entityType="Project"
        entityId={params.id}
        title="Project History"
      />

      <ProjectActions project={project} members={members} userRole={userRole} />
    </div>
  )
}
