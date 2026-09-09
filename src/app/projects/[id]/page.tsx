import { prisma } from '@/lib/prisma'
import { fetchProjectForDetailPage, serializeMilestoneBug, serializeMilestoneTestCase } from '@/lib/project-queries'
import { fmtCurrency, STATUS_COLORS, PROJECT_STATUS_LABELS } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import QAReadyPrompt from './QAReadyPrompt'
import DeleteProjectButton from './DeleteProjectButton'
import EditProjectForm from './EditProjectForm'
import { QASignOffBadge } from '@/components/QASignOffStatus'
import ProjectDetailTabs from './ProjectDetailTabs'
import { canDeleteProject, canEditProject, projectEditFields } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const userRole = session?.user?.role
  const userId = session?.user?.id
  const isBD = userRole && ['BD', 'Founder', 'Both'].includes(userRole)
  const isDev = userRole === 'Dev'

  const [project, members, wonLeads] = await Promise.all([
    fetchProjectForDetailPage(params.id),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } }),
    prisma.lead.findMany({
      where: {
        status: 'won',
        OR: [{ project: null }, { project: { id: params.id } }],
      },
      select: { id: true, clientName: true },
      orderBy: { clientName: 'asc' },
    }),
  ])

  if (!project) notFound()

  if (isDev && project.developerId !== userId && !project.assignees.some(a => a.memberId === userId)) notFound()

  const assigneeNames = [
    project.developer.name,
    ...project.assignees.map(a => a.member.name).filter(name => name !== project.developer.name),
  ]
  const assignment = {
    developerId: project.developerId,
    bdMemberId: project.bdMemberId,
    assigneeIds: project.assignees.map(a => a.memberId),
  }
  const showEdit = canEditProject(assignment, userId, userRole)
  const showDelete = canDeleteProject(userRole)
  const editableFields = Array.from(projectEditFields(assignment, userId, userRole))

  const estAccuracy = project.actualHours && project.estimatedHours
    ? Math.round((project.actualHours / project.estimatedHours) * 100)
    : null
  const activeScopeChanges = project.scopeChanges.filter(s => s.approvalStatus !== 'declined')
  const totalScopeHours = activeScopeChanges.reduce((s, c) => s + (c.hoursAdded || 0), 0)
  const unsignedCOs = activeScopeChanges.filter(s => !s.changeOrderSigned)

  const totalMilestones = project.milestones.length
  const completedMilestones = project.milestones.filter(m => m.status === 'done').length
  const calculatedProgress = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0

  const allMilestonesReadyForQA = totalMilestones > 0 &&
    project.milestones.every(m => m.status === 'ready_for_qa' || m.status === 'done')
  const showQAPrompt = allMilestonesReadyForQA &&
    project.status !== 'qa' &&
    project.status !== 'delivered' &&
    project.status !== 'cancelled' &&
    (userRole === 'Dev' || userRole === 'Founder' || userRole === 'Both')

  return (
    <div className="w-full">
      <div className="text-xs text-gray-400 mb-2">← <a href="/projects" className="hover:text-gray-700">Projects</a></div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
            <span className={`badge ${STATUS_COLORS[project.status]}`}>{PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
            {project.releaseSignOff && <QASignOffBadge signed />}
          </div>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>Developer{assigneeNames.length > 1 ? 's' : ''}: {assigneeNames.join(', ')}</span>
            {project.bdMember && <span>BD: {project.bdMember.name}</span>}
            {project.clientName && <span>Client: {project.clientName}</span>}
            {project.contractValue && isBD && <span>Value: {fmtCurrency(project.contractValue, project.currency)}</span>}
            {project.lead && <span>Source: {project.lead.source}</span>}
          </div>
        </div>
        {(showEdit || showDelete) && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {showEdit && (
                <EditProjectForm
                  project={{
                    id: project.id,
                    name: project.name,
                    leadId: project.leadId,
                    developerId: project.developerId,
                    assigneeIds: assignment.assigneeIds,
                    bdMemberId: project.bdMemberId,
                    clientName: project.clientName,
                    contractValue: project.contractValue,
                    currency: project.currency,
                    estimatedHours: project.estimatedHours,
                    actualHours: project.actualHours,
                    techStack: project.techStack,
                    startDate: project.startDate?.toISOString() ?? null,
                    estimatedEnd: project.estimatedEnd?.toISOString() ?? null,
                  }}
                  members={members}
                  wonLeads={wonLeads}
                  editableFields={editableFields}
                />
              )}
              {showDelete && (
                <DeleteProjectButton projectId={project.id} projectName={project.name} />
              )}
            </div>
          </div>
        )}
      </div>

      {unsignedCOs.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-800">
          ⚠️ {unsignedCOs.length} scope change(s) without a signed change order. Do not proceed with this work until signed.
        </div>
      )}

      {showQAPrompt && (
        <QAReadyPrompt projectId={project.id} projectName={project.name} />
      )}

      <ProjectDetailTabs
        projectId={project.id}
        projectStatus={project.status}
        userRole={userRole}
        userId={userId}
        isBD={!!isBD}
        members={members}
        stats={{
          calculatedProgress,
          completedMilestones,
          totalMilestones,
          estAccuracy,
          totalScopeHours,
        }}
        project={{
          id: project.id,
          status: project.status,
          postMortem: project.postMortem,
          bdMemberId: project.bdMemberId,
          developerId: project.developerId,
          assigneeIds: assignment.assigneeIds,
          qaModulesDelivered: project.qaModulesDelivered,
          qaSuggestedTestType: project.qaSuggestedTestType,
          qaTestingNotes: project.qaTestingNotes,
          qaAreasChanged: project.qaAreasChanged,
          qaHandoffAt: project.qaHandoffAt?.toISOString() ?? null,
          estimatedHours: project.estimatedHours,
          actualHours: project.actualHours,
          releaseSignOff: project.releaseSignOff ? {
            signedOffAt: project.releaseSignOff.signedOffAt.toISOString(),
            signedOffBy: { name: project.releaseSignOff.signedOffBy.name },
            qualityScore: project.releaseSignOff.qualityScore,
            releaseNotes: project.releaseSignOff.releaseNotes,
            exceptionsNotes: project.releaseSignOff.exceptionsNotes,
            sanityPassed: project.releaseSignOff.sanityPassed,
            regressionPassed: project.releaseSignOff.regressionPassed,
            noBlockersOpen: project.releaseSignOff.noBlockersOpen,
            stagingMatchesLive: project.releaseSignOff.stagingMatchesLive,
            clientUATDone: project.releaseSignOff.clientUATDone,
            knownIssuesAgreed: project.releaseSignOff.knownIssuesAgreed,
          } : null,
          testCycles: project.testCycles.map(c => ({
            id: c.id,
            cycleType: c.cycleType,
            environment: c.environment,
            result: c.result,
            startedAt: c.startedAt.toISOString(),
            summary: c.summary,
            blockerNote: c.blockerNote,
            fixedInCycle: c.fixedInCycle,
            testedAuth: c.testedAuth,
            testedCoreFlows: c.testedCoreFlows,
            testedEdgeCases: c.testedEdgeCases,
            testedMobile: c.testedMobile,
            testedCrossBrowser: c.testedCrossBrowser,
            testedPerformance: c.testedPerformance,
            testedIntegrations: c.testedIntegrations,
            testedDataIntegrity: c.testedDataIntegrity,
            conductedBy: { name: c.conductedBy.name },
            signOff: c.signOff ? { signedOffBy: { name: c.signOff.signedOffBy.name } } : null,
            cases: c.cases,
          })),
          postDeliveryIssues: project.postDeliveryIssues.map(i => ({
            id: i.id,
            reportedAt: i.reportedAt.toISOString(),
            reportedBy: i.reportedBy,
            description: i.description,
            severity: i.severity,
            wasInScope: i.wasInScope,
            rootCause: i.rootCause,
            resolutionNotes: i.resolutionNotes,
            resolvedAt: i.resolvedAt?.toISOString() ?? null,
          })),
          milestones: project.milestones.map(m => ({
            id: m.id,
            title: m.title,
            dueDate: m.dueDate.toISOString(),
            status: m.status,
            completedAt: m.completedAt?.toISOString() ?? null,
            qaStartedAt: m.qaStartedAt?.toISOString() ?? null,
            testCases: m.testCases.map(serializeMilestoneTestCase),
            bugs: m.bugs.map(serializeMilestoneBug),
          })),
          scopeChanges: project.scopeChanges.map(sc => ({
            id: sc.id,
            description: sc.description,
            hoursAdded: sc.hoursAdded,
            valueAdded: sc.valueAdded,
            changeOrderSigned: sc.changeOrderSigned,
            approvalStatus: sc.approvalStatus,
            decisionNote: sc.decisionNote,
            createdAt: sc.createdAt.toISOString(),
            approvedBy: sc.approvedBy ? { name: sc.approvedBy.name } : null,
          })),
          checkIns: project.checkIns.map(ci => ({
            id: ci.id,
            weekOf: ci.weekOf.toISOString(),
            progressPct: ci.progressPct,
            onTrack: ci.onTrack,
            blockers: ci.blockers,
            submittedBy: { name: ci.submittedBy.name },
          })),
        }}
      />
    </div>
  )
}
