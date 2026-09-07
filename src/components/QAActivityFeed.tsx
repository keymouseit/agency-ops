import { fmtDate } from '@/lib/utils'
import Link from 'next/link'
import {
  QA_SEVERITY_CLS,
  QA_SIGNOFF_CHECKLIST,
} from '@/lib/qa'
import TestCyclesList from '@/components/TestCyclesList'
import type { TestCycleDetail } from '@/components/TestCycleDetailModal'
import MilestoneTestProgress from '@/components/MilestoneTestProgress'
import { MILESTONE_STATUS_CONFIG, milestoneHasTestingVisibility } from '@/lib/milestone-qa'

type TestCycle = TestCycleDetail

type SignOff = {
  signedOffAt: Date | string
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
}

type PostDeliveryIssue = {
  id: string
  reportedAt: Date | string
  reportedBy: string
  description: string
  severity: string
  wasInScope: boolean | null
  rootCause: string | null
  resolutionNotes: string | null
  resolvedAt: Date | string | null
}

type Milestone = {
  id: string
  title: string
  dueDate: Date | string
  status: string
  completedAt: Date | string | null
  qaStartedAt?: string | null
  testCases?: Array<{
    id: string
    title: string
    status: string
    notes: string | null
    testedAt: string | null
    testedBy: { name: string } | null
  }>
  bugs?: Array<{
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
}

type Props = {
  qaModulesDelivered: string | null
  qaSuggestedTestType: string | null
  qaTestingNotes: string | null
  qaAreasChanged: string | null
  qaHandoffAt: Date | null
  testCycles: TestCycle[]
  releaseSignOff: SignOff | null
  postDeliveryIssues: PostDeliveryIssue[]
  milestones?: Milestone[]
  projectStatus?: string
  allowDevFix?: boolean
  qaDetailHref?: string
}

export default function QAActivityFeed({
  qaModulesDelivered,
  qaSuggestedTestType,
  qaTestingNotes,
  qaAreasChanged,
  qaHandoffAt,
  testCycles,
  releaseSignOff,
  postDeliveryIssues,
  milestones = [],
  projectStatus = 'active',
  allowDevFix = false,
  qaDetailHref,
}: Props) {
  const qaMilestones = milestones.filter(m =>
    m.status === 'ready_for_qa' || m.status === 'testing' || m.status === 'done'
  )
  const hasDetailedContent = !!(
    qaHandoffAt ||
    qaModulesDelivered ||
    testCycles.length > 0 ||
    releaseSignOff ||
    postDeliveryIssues.length > 0
  )
  const showSection = hasDetailedContent
    || qaMilestones.length > 0
    || projectStatus === 'qa'
    || projectStatus === 'delivered'

  if (!showSection) return null

  const waitingForTestCycles = (projectStatus === 'qa' || projectStatus === 'delivered')
    && testCycles.length === 0
    && !releaseSignOff

  return (
    <div id="qa-updates" className="card p-5 mb-4 border-teal-100">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-900">QA updates</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Milestone reviews, test cycles, sign-off, and feedback from the QA team.
        </p>
      </div>

      {qaMilestones.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Milestone reviews</h3>
          <div className="space-y-2">
            {qaMilestones.map(m => {
              const statusCfg = MILESTONE_STATUS_CONFIG[m.status] ?? MILESTONE_STATUS_CONFIG.pending
              const testCases = m.testCases ?? []
              const bugs = m.bugs ?? []
              const showCases = milestoneHasTestingVisibility(m.status, testCases.length, bugs.length)

              return (
              <div
                key={m.id}
                className={`p-3 rounded-lg border text-sm ${
                  m.status === 'done'
                    ? 'bg-green-50 border-green-200'
                    : m.status === 'testing'
                    ? 'bg-teal-50 border-teal-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${
                      m.status === 'done' ? 'text-green-900' : m.status === 'testing' ? 'text-teal-900' : 'text-blue-900'
                    }`}>
                      {m.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Due {fmtDate(m.dueDate)}
                      {m.status === 'done' && m.completedAt && (
                        <> · QA approved {fmtDate(m.completedAt)}</>
                      )}
                      {m.status === 'testing' && m.qaStartedAt && (
                        <> · Testing since {fmtDate(m.qaStartedAt)}</>
                      )}
                    </div>
                  </div>
                  <span className={`badge text-xs shrink-0 ${statusCfg.cls}`}>
                    {statusCfg.label}
                  </span>
                </div>

                {showCases && (
                  <MilestoneTestProgress
                    milestoneTitle={m.title}
                    milestoneStatus={m.status}
                    qaStartedAt={m.qaStartedAt}
                    testCases={testCases}
                    bugs={bugs}
                    compact
                  />
                )}
              </div>
            )})}
          </div>
        </div>
      )}

      {waitingForTestCycles && (
        <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
          Project is in QA — test cycle reports will appear here when QA logs them.
        </div>
      )}

      {!hasDetailedContent && qaMilestones.length > 0 && projectStatus === 'active' && (
        <div className="mb-5 p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-600">
          Milestone test progress appears here once QA starts testing. Project-level test cycle reports appear after the project moves to QA status.
        </div>
      )}

      {qaModulesDelivered && (
        <div className="mb-5 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
            QA handoff
            {qaHandoffAt && (
              <span className="text-xs text-purple-600 font-normal">
                · {fmtDate(qaHandoffAt)}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-purple-700 font-medium mb-1">Modules / features delivered</div>
              <p className="text-sm text-purple-900 whitespace-pre-wrap">{qaModulesDelivered}</p>
            </div>
            {qaSuggestedTestType && (
              <div>
                <div className="text-xs text-purple-700 font-medium mb-1">Suggested test type</div>
                <span className="inline-block text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded capitalize">
                  {qaSuggestedTestType}
                </span>
              </div>
            )}
            {qaTestingNotes && (
              <div>
                <div className="text-xs text-purple-700 font-medium mb-1">Testing notes</div>
                <p className="text-sm text-purple-900 whitespace-pre-wrap">{qaTestingNotes}</p>
              </div>
            )}
            {qaAreasChanged && (
              <div>
                <div className="text-xs text-purple-700 font-medium mb-1">Areas changed</div>
                <p className="text-sm text-purple-900 whitespace-pre-wrap font-mono text-xs">{qaAreasChanged}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {testCycles.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Test cycles</h3>
            {qaDetailHref && (
              <Link href={qaDetailHref} className="text-xs font-medium text-teal-700 hover:text-teal-900">
                Full QA details →
              </Link>
            )}
          </div>
          <TestCyclesList
            testCycles={testCycles}
            allowDevFix={allowDevFix}
          />
        </div>
      )}

      {releaseSignOff && (
        <div className="mb-5 p-4 bg-green-50 border border-green-100 rounded-xl">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Release sign-off</h3>
          <div className="text-xs text-green-700 mb-3">
            Signed off by {releaseSignOff.signedOffBy.name} on {fmtDate(releaseSignOff.signedOffAt)}
            {releaseSignOff.qualityScore != null && ` · Quality score: ${releaseSignOff.qualityScore}/10`}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {QA_SIGNOFF_CHECKLIST.map(item => (
              <div key={item.key} className="flex items-center gap-2 text-sm">
                <span className={releaseSignOff[item.key as keyof SignOff] ? 'text-green-600' : 'text-red-500'}>
                  {releaseSignOff[item.key as keyof SignOff] ? '✓' : '✗'}
                </span>
                <span className="text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
          {releaseSignOff.releaseNotes && (
            <p className="text-sm text-green-800 whitespace-pre-wrap">{releaseSignOff.releaseNotes}</p>
          )}
          {releaseSignOff.exceptionsNotes && (
            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded mt-2">
              Exceptions noted: {releaseSignOff.exceptionsNotes}
            </div>
          )}
        </div>
      )}

      {postDeliveryIssues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Post-delivery issues</h3>
          <div className="space-y-3">
            {postDeliveryIssues.map(issue => (
              <div
                key={issue.id}
                className={`p-3 rounded-lg border text-sm ${
                  issue.resolvedAt ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-red-50 border-red-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`badge text-xs ${QA_SEVERITY_CLS[issue.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                        {issue.severity}
                      </span>
                      <span className="text-xs text-gray-400">
                        Reported by {issue.reportedBy} · {fmtDate(issue.reportedAt)}
                      </span>
                      {issue.wasInScope === true && (
                        <span className="badge bg-red-100 text-red-700 text-xs">QA miss</span>
                      )}
                    </div>
                    <p className="text-gray-800 whitespace-pre-wrap">{issue.description}</p>
                    {issue.rootCause && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">Root cause: {issue.rootCause}</p>
                    )}
                    {issue.resolutionNotes && (
                      <p className="text-xs text-green-700 mt-1 whitespace-pre-wrap">✓ {issue.resolutionNotes}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {issue.resolvedAt
                      ? <span className="badge bg-green-100 text-green-700 text-xs">Resolved</span>
                      : <span className="badge bg-red-100 text-red-700 text-xs">Open</span>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
