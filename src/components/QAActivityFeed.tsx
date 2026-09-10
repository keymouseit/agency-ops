import type { ReactNode } from 'react'
import { fmtDate } from '@/lib/utils'
import Link from 'next/link'
import {
  QA_SEVERITY_CLS,
  QA_SIGNOFF_CHECKLIST,
} from '@/lib/qa'
import TestCyclesList from '@/components/TestCyclesList'
import type { TestCycleDetail } from '@/components/TestCycleDetailModal'
import MilestoneTestProgress from '@/components/MilestoneTestProgress'
import {
  MILESTONE_STATUS_CONFIG,
  milestoneHasTestingVisibility,
  openBugCount,
  testCaseSummary,
} from '@/lib/milestone-qa'

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
  dueDate: Date | string | null
  status: string
  completedAt: Date | string | null
  notes?: string | null
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

function SummaryChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: 'neutral' | 'blue' | 'teal' | 'green' | 'amber' | 'red'
}) {
  const tones = {
    neutral: 'bg-gray-50 text-gray-800 border-gray-100',
    blue: 'bg-blue-50 text-blue-800 border-blue-100',
    teal: 'bg-teal-50 text-teal-800 border-teal-100',
    green: 'bg-green-50 text-green-800 border-green-100',
    amber: 'bg-amber-50 text-amber-800 border-amber-100',
    red: 'bg-red-50 text-red-800 border-red-100',
  }
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tones[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
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
  const inQaCount = milestones.filter(m => m.status === 'ready_for_qa').length
  const testingCount = milestones.filter(m => m.status === 'testing').length
  const approvedCount = milestones.filter(m => m.status === 'done').length
  const qaMilestones = milestones.filter(m =>
    m.status === 'ready_for_qa' || m.status === 'testing' || m.status === 'done'
  )
  const openIssues = postDeliveryIssues.filter(i => !i.resolvedAt).length
  const hasHandoff = !!(qaModulesDelivered || qaSuggestedTestType || qaTestingNotes || qaAreasChanged)
  const waitingForTestCycles =
    (projectStatus === 'qa' || projectStatus === 'delivered') &&
    testCycles.length === 0 &&
    !releaseSignOff

  const empty =
    qaMilestones.length === 0 &&
    !hasHandoff &&
    testCycles.length === 0 &&
    !releaseSignOff &&
    postDeliveryIssues.length === 0

  return (
    <div id="qa-updates" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">QA updates</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Milestone reviews, test cycles, handoff, and release sign-off.
          </p>
        </div>
        {qaDetailHref && (
          <Link
            href={qaDetailHref}
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Open QA workspace →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <SummaryChip label="In QA" value={inQaCount} tone="blue" />
        <SummaryChip label="Testing" value={testingCount} tone="teal" />
        <SummaryChip label="Approved" value={approvedCount} tone="green" />
        <SummaryChip label="Cycles" value={testCycles.length} tone="neutral" />
        <SummaryChip
          label="Sign-off"
          value={releaseSignOff ? 'Done' : projectStatus === 'qa' ? 'Pending' : '—'}
          tone={releaseSignOff ? 'green' : projectStatus === 'qa' ? 'amber' : 'neutral'}
        />
      </div>

      {empty && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center">
          <p className="text-sm font-medium text-gray-700">No QA activity yet</p>
          <p className="mt-1 text-sm text-gray-400">
            When milestones move to QA, handoff notes and test cycles will show up here.
          </p>
        </div>
      )}

      {qaMilestones.length > 0 && (
        <Section title="Milestone reviews">
          <div className="divide-y divide-gray-100">
            {qaMilestones.map(m => {
              const statusCfg = MILESTONE_STATUS_CONFIG[m.status] ?? MILESTONE_STATUS_CONFIG.pending
              const testCases = m.testCases ?? []
              const bugs = m.bugs ?? []
              const showCases = milestoneHasTestingVisibility(m.status, testCases.length, bugs.length)
              const summary = testCaseSummary(testCases)
              const bugsOpen = openBugCount(bugs)

              return (
                <div key={m.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900">{m.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                        <span>{m.dueDate ? `Due ${fmtDate(m.dueDate)}` : 'No due date'}</span>
                        {m.status === 'done' && m.completedAt && (
                          <span>· Approved {fmtDate(m.completedAt)}</span>
                        )}
                        {m.status === 'testing' && m.qaStartedAt && (
                          <span>· Testing since {fmtDate(m.qaStartedAt)}</span>
                        )}
                        {summary.total > 0 && (
                          <span>
                            · {summary.passed}/{summary.total} cases
                          </span>
                        )}
                        {bugsOpen > 0 && (
                          <span className="text-red-600">· {bugsOpen} open bug{bugsOpen === 1 ? '' : 's'}</span>
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
              )
            })}
          </div>
        </Section>
      )}

      {hasHandoff && (
        <Section
          title="QA handoff"
          action={
            qaHandoffAt ? (
              <span className="text-xs text-gray-400">{fmtDate(qaHandoffAt)}</span>
            ) : null
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {qaModulesDelivered && (
              <div className="sm:col-span-2">
                <div className="text-xs font-medium text-gray-400 mb-1">Modules / features</div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{qaModulesDelivered}</p>
              </div>
            )}
            {qaSuggestedTestType && (
              <div>
                <div className="text-xs font-medium text-gray-400 mb-1">Suggested test type</div>
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 capitalize">
                  {qaSuggestedTestType}
                </span>
              </div>
            )}
            {qaTestingNotes && (
              <div className={qaSuggestedTestType ? '' : 'sm:col-span-2'}>
                <div className="text-xs font-medium text-gray-400 mb-1">Testing notes</div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{qaTestingNotes}</p>
              </div>
            )}
            {qaAreasChanged && (
              <div className="sm:col-span-2">
                <div className="text-xs font-medium text-gray-400 mb-1">Areas changed</div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  {qaAreasChanged}
                </p>
              </div>
            )}
          </div>
        </Section>
      )}

      {(testCycles.length > 0 || waitingForTestCycles) && (
        <Section
          title="Test cycles"
          action={
            qaDetailHref ? (
              <Link href={qaDetailHref} className="text-xs font-medium text-gray-500 hover:text-gray-800">
                Manage in QA →
              </Link>
            ) : null
          }
        >
          {waitingForTestCycles ? (
            <p className="text-sm text-gray-500">
              Project is in QA — cycle reports will appear here when QA logs them.
            </p>
          ) : (
            <TestCyclesList testCycles={testCycles} allowDevFix={allowDevFix} />
          )}
        </Section>
      )}

      {releaseSignOff && (
        <Section title="Release sign-off">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-3">
            <span className="badge bg-green-100 text-green-800">Signed off</span>
            <span>
              by {releaseSignOff.signedOffBy.name} · {fmtDate(releaseSignOff.signedOffAt)}
            </span>
            {releaseSignOff.qualityScore != null && (
              <span>· Quality {releaseSignOff.qualityScore}/10</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
            {QA_SIGNOFF_CHECKLIST.map(item => {
              const ok = !!releaseSignOff[item.key as keyof SignOff]
              return (
                <div key={item.key} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className={ok ? 'text-green-600' : 'text-red-500'}>{ok ? '✓' : '✗'}</span>
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
          {releaseSignOff.releaseNotes && (
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{releaseSignOff.releaseNotes}</p>
          )}
          {releaseSignOff.exceptionsNotes && (
            <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Exceptions: {releaseSignOff.exceptionsNotes}
            </div>
          )}
        </Section>
      )}

      {postDeliveryIssues.length > 0 && (
        <Section
          title="Post-delivery issues"
          action={
            openIssues > 0 ? (
              <span className="text-xs font-medium text-red-600">{openIssues} open</span>
            ) : (
              <span className="text-xs text-gray-400">All resolved</span>
            )
          }
        >
          <div className="space-y-2">
            {postDeliveryIssues.map(issue => (
              <div
                key={issue.id}
                className={`rounded-xl border px-3 py-3 ${
                  issue.resolvedAt
                    ? 'border-gray-100 bg-gray-50/80'
                    : 'border-red-100 bg-red-50/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`badge text-xs ${QA_SEVERITY_CLS[issue.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                        {issue.severity}
                      </span>
                      <span className="text-xs text-gray-400">
                        {issue.reportedBy} · {fmtDate(issue.reportedAt)}
                      </span>
                      {issue.wasInScope === true && (
                        <span className="badge bg-red-100 text-red-700 text-xs">QA miss</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{issue.description}</p>
                    {issue.rootCause && (
                      <p className="text-xs text-gray-500 mt-1">Root cause: {issue.rootCause}</p>
                    )}
                    {issue.resolutionNotes && (
                      <p className="text-xs text-green-700 mt-1">✓ {issue.resolutionNotes}</p>
                    )}
                  </div>
                  <span
                    className={`badge text-xs shrink-0 ${
                      issue.resolvedAt
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {issue.resolvedAt ? 'Resolved' : 'Open'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
