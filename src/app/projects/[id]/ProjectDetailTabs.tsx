'use client'

import { useEffect, useState } from 'react'
import { fmtDate, STATUS_COLORS } from '@/lib/utils'
import { canViewQATestCycles } from '@/lib/qa-access'
import DeveloperMilestones from './DeveloperMilestones'
import ScopeChangesCard from './ScopeChangesCard'
import ProjectActions from './ProjectActions'
import QASignOffStatus from '@/components/QASignOffStatus'
import QAActivityFeed from '@/components/QAActivityFeed'
import EntityAuditTrail from '@/components/EntityAuditTrail'

type TabId = 'overview' | 'milestones' | 'qa' | 'scope' | 'checkins' | 'history'

type Member = { id: string; name: string; role: string }

type ScopeChange = {
  id: string
  description: string
  hoursAdded: number | null
  valueAdded: number | null
  changeOrderSigned: boolean
  approvalStatus: string
  decisionNote: string | null
  createdAt: string
  approvedBy: { name: string } | null
}

type CheckIn = {
  id: string
  weekOf: string
  progressPct: number
  onTrack: string
  blockers: string | null
  submittedBy: { name: string }
}

type PostMortem = {
  estimationAccuracy: number | null
  clientSatisfaction: number | null
  whatBroke: string | null
  whatWorked: string | null
  preventionAction: string | null
}

type Props = {
  projectId: string
  projectStatus: string
  userRole?: string
  userId?: string
  isBD: boolean
  members: Member[]
  project: {
    id: string
    status: string
    postMortem: PostMortem | null
    bdMemberId: string | null
    developerId: string
    assigneeIds?: string[]
    qaModulesDelivered: string | null
    qaSuggestedTestType: string | null
    qaTestingNotes: string | null
    qaAreasChanged: string | null
    qaHandoffAt: string | null
    estimatedHours: number | null
    actualHours: number | null
    releaseSignOff: {
      signedOffAt: string
      signedOffBy: { name: string }
      qualityScore: number | null
      releaseNotes: string | null
      exceptionsNotes: string | null
      sanityPassed: boolean
      regressionPassed: boolean
      noBlockersOpen: boolean
      stagingMatchesLive: boolean
      clientUATDone: boolean
      knownIssuesAgreed: boolean
    } | null
    testCycles: Array<{
      id: string
      cycleType: string
      environment: string
      result: string
      startedAt: string
      summary: string | null
      blockerNote: string | null
      fixedInCycle: string | null
      testedAuth: boolean
      testedCoreFlows: boolean
      testedEdgeCases: boolean
      testedMobile: boolean
      testedCrossBrowser: boolean
      testedPerformance: boolean
      testedIntegrations: boolean
      testedDataIntegrity: boolean
      conductedBy: { name: string }
      signOff: { signedOffBy: { name: string } } | null
      cases: Array<{
        id: string
        title: string
        status: string
        notes: string | null
        devFixedAt?: string | null
        devFixNotes?: string | null
        devFixedBy?: { name: string } | null
      }>
    }>
    postDeliveryIssues: Array<{
      id: string
      reportedAt: string
      reportedBy: string
      description: string
      severity: string
      wasInScope: boolean | null
      rootCause: string | null
      resolutionNotes: string | null
      resolvedAt: string | null
    }>
    milestones: Array<{
      id: string
      title: string
      dueDate: string | null,
      status: string
      completedAt: string | null
      qaStartedAt: string | null
      testCases: Array<{
        id: string
        title: string
        status: string
        notes: string | null
        testedAt: string | null
        testedBy: { name: string } | null
      }>
      bugs: Array<{
        id: string
        title: string
        description: string | null
        severity: string
        status: string
        testCaseId: string | null
        reportedAt: string
        reportedBy: { name: string }
        resolvedAt: string | null
        resolutionNotes: string | null
      }>
    }>
    scopeChanges: ScopeChange[]
    checkIns: CheckIn[]
  }
  stats: {
    calculatedProgress: number
    completedMilestones: number
    totalMilestones: number
    estAccuracy: number | null
    totalScopeHours: number
  }
}

const TAB_HASH: Record<string, TabId> = {
  overview: 'overview',
  milestones: 'milestones',
  qa: 'qa',
  'qa-updates': 'qa',
  scope: 'scope',
  checkins: 'checkins',
  history: 'history',
}

export default function ProjectDetailTabs({ projectId, projectStatus, userRole, userId, isBD, members, project, stats }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const qaMilestoneCount = project.milestones.filter(m =>
    m.status === 'ready_for_qa' || m.status === 'testing' || m.status === 'done'
  ).length
  const qaTabCount = qaMilestoneCount + project.testCycles.length + (project.releaseSignOff ? 1 : 0)
  const pendingScopeCount = project.scopeChanges.filter(s => s.approvalStatus === 'pending').length

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'milestones', label: 'Milestones', badge: project.milestones.length || undefined },
    { id: 'qa', label: 'QA updates', badge: qaTabCount || undefined },
    { id: 'scope', label: 'Scope', badge: pendingScopeCount || undefined },
    { id: 'checkins', label: 'Check-ins', badge: project.checkIns.length || undefined },
    { id: 'history', label: 'History' },
  ]

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && TAB_HASH[hash]) {
      setActiveTab(TAB_HASH[hash])
    }
  }, [])

  function selectTab(id: TabId) {
    setActiveTab(id)
    window.history.replaceState(null, '', `#${id}`)
  }

  const showQADetailLink = canViewQATestCycles(userRole)

  return (
    <div>
      <div className="border-b border-gray-200 mb-6 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <QASignOffStatus
            projectId={projectId}
            projectStatus={projectStatus}
            signOff={project.releaseSignOff}
            latestCycle={project.testCycles[0] ?? null}
            showQALink={showQADetailLink}
          />

          {stats.totalMilestones > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900">Overall progress</h2>
                <span className={`text-lg font-bold ${
                  stats.calculatedProgress >= 80 ? 'text-green-600' :
                  stats.calculatedProgress >= 50 ? 'text-amber-600' :
                  stats.calculatedProgress >= 25 ? 'text-blue-600' :
                  'text-gray-500'
                }`}>
                  {stats.calculatedProgress}%
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    stats.calculatedProgress >= 80 ? 'bg-green-500' :
                    stats.calculatedProgress >= 50 ? 'bg-amber-400' :
                    stats.calculatedProgress >= 25 ? 'bg-blue-500' :
                    'bg-gray-400'
                  }`}
                  style={{ width: `${stats.calculatedProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {stats.completedMilestones} of {stats.totalMilestones} milestones completed
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Estimated hours', value: project.estimatedHours?.toString() ?? '—' },
              { label: 'Actual hours', value: project.actualHours?.toString() ?? '—' },
              {
                label: 'Est. accuracy',
                value: stats.estAccuracy != null ? `${stats.estAccuracy}%` : '—',
                danger: stats.estAccuracy != null && stats.estAccuracy > 120,
              },
              {
                label: 'Scope drift (hrs)',
                value: stats.totalScopeHours > 0 ? `+${stats.totalScopeHours}h` : '0h',
                danger: stats.totalScopeHours > 20,
              },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</div>
                <div className={`text-xl font-semibold ${s.danger ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</div>
              </div>
            ))}
          </div>

          <ProjectActions
            project={{
              id: project.id,
              status: project.status,
              postMortem: project.postMortem,
              bdMemberId: project.bdMemberId,
              developerId: project.developerId,
              assigneeIds: project.assigneeIds,
            }}
            members={members}
            userRole={userRole}
          />
        </div>
      )}

      {activeTab === 'milestones' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Milestones</h2>
          <DeveloperMilestones
            milestones={project.milestones.map(m => ({
              ...m,
              dueDate: m.dueDate ? new Date(m.dueDate) : null,
              completedAt: m.completedAt ? new Date(m.completedAt) : null,
            }))}
            projectId={projectId}
          />
        </div>
      )}

      {activeTab === 'qa' && (
        <QAActivityFeed
          qaModulesDelivered={project.qaModulesDelivered}
          qaSuggestedTestType={project.qaSuggestedTestType}
          qaTestingNotes={project.qaTestingNotes}
          qaAreasChanged={project.qaAreasChanged}
          qaHandoffAt={project.qaHandoffAt ? new Date(project.qaHandoffAt) : null}
          testCycles={project.testCycles}
          releaseSignOff={project.releaseSignOff}
          postDeliveryIssues={project.postDeliveryIssues}
          milestones={project.milestones}
          projectStatus={project.status}
          allowDevFix={userRole === 'Dev' || userRole === 'Both' || userRole === 'Founder'}
          qaDetailHref={showQADetailLink ? `/qa/${projectId}` : undefined}
        />
      )}

      {activeTab === 'scope' && (
        <ScopeChangesCard
          projectId={projectId}
          bdMemberId={project.bdMemberId}
          currentUserId={userId}
          userRole={userRole}
          canViewValue={isBD}
          scopeChanges={project.scopeChanges}
        />
      )}

      {activeTab === 'checkins' && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Weekly check-ins</h2>
          {project.checkIns.length === 0 ? (
            <p className="text-sm text-gray-400">No check-ins submitted yet.</p>
          ) : (
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
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {project.postMortem && (
            <div className="card p-5 bg-blue-50 border-blue-100">
              <h2 className="text-sm font-semibold text-blue-900 mb-3">Post-mortem</h2>
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <span className="label">Est. accuracy</span>
                  <span className={project.postMortem.estimationAccuracy && project.postMortem.estimationAccuracy > 1.2 ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold'}>
                    {project.postMortem.estimationAccuracy ? `${Math.round(project.postMortem.estimationAccuracy * 100)}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="label">Client satisfaction</span>
                  <span className="font-semibold">{project.postMortem.clientSatisfaction ?? '—'}/10</span>
                </div>
              </div>
              {project.postMortem.whatBroke && (
                <div className="mb-2">
                  <span className="label text-red-600">What broke</span>
                  <p className="text-red-800 text-sm">{project.postMortem.whatBroke}</p>
                </div>
              )}
              {project.postMortem.whatWorked && (
                <div className="mb-2">
                  <span className="label text-green-700">What worked</span>
                  <p className="text-green-800 text-sm">{project.postMortem.whatWorked}</p>
                </div>
              )}
              {project.postMortem.preventionAction && (
                <div>
                  <span className="label text-blue-700">Action items</span>
                  <p className="text-blue-800 text-sm">{project.postMortem.preventionAction}</p>
                </div>
              )}
            </div>
          )}
          <EntityAuditTrail entityType="Project" entityId={projectId} title="Project history" />
        </div>
      )}
    </div>
  )
}
