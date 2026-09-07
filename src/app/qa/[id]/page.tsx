import { prisma } from '@/lib/prisma'
import { fetchProjectForQAPage, serializeMilestoneBug, serializeMilestoneTestCase } from '@/lib/project-queries'
import { testCycleCaseSummary, QA_CYCLE_RESULT_CONFIG, isBlockingCycleResult } from '@/lib/qa'
import { canManageQATestCycles, canViewQATestCycles } from '@/lib/qa-access'
import { auth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import QAProjectActions from './QAProjectActions'
import MilestoneApproval from './MilestoneApproval'
import EntityAuditTrail from '@/components/EntityAuditTrail'
import TestCyclesPanel from './TestCyclesPanel'

export const dynamic = 'force-dynamic'

const RESULT_CONFIG = QA_CYCLE_RESULT_CONFIG

const SEVERITY_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-orange-100 text-orange-800',
  medium:   'bg-amber-100 text-amber-800',
  low:      'bg-gray-100 text-gray-600',
}

export default async function QAProjectPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!canViewQATestCycles(session?.user?.role)) redirect('/')

  const canManageQA = canManageQATestCycles(session?.user?.role)

  const [project, members] = await Promise.all([
    fetchProjectForQAPage(params.id),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  if (!project) notFound()

  const latestCycle = project.testCycles[0]
  const signOff = project.releaseSignOff
  const canSignOff = latestCycle?.result === 'pass' || latestCycle?.result === 'conditional'
  const hasSignOff = !!signOff
  const latestCycleFixSummary = latestCycle?.cases?.length
    ? testCycleCaseSummary(latestCycle.cases)
    : null
  const devFixesReadyForRetest = isBlockingCycleResult(latestCycle?.result ?? '')
    && latestCycleFixSummary?.allFailuresFixed

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400 mb-2">
        ← <Link href="/qa" className="hover:text-gray-700">QA Dashboard</Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{project.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span>Dev owner: {project.developer.name}</span>
            <span>·</span>
            <span className={`badge ${project.status === 'qa' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-600'}`}>
              {project.status}
            </span>
          </div>
        </div>
      </div>

      {!canManageQA && (
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
          View-only access — you can review QA test cycles and milestone progress logged by the QA team.
        </div>
      )}

      {/* QA Handoff Information */}
      {project.qaModulesDelivered && (
        <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
            📋 QA Handoff Information
            {project.qaHandoffAt && (
              <span className="text-xs text-purple-600 font-normal">
                · Handed off on {fmtDate(project.qaHandoffAt)}
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-purple-700 font-medium mb-1">Modules/Features Delivered:</div>
              <p className="text-sm text-purple-900">{project.qaModulesDelivered}</p>
            </div>
            {project.qaSuggestedTestType && (
              <div>
                <div className="text-xs text-purple-700 font-medium mb-1">Suggested Test Type:</div>
                <span className="inline-block text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded capitalize">
                  {project.qaSuggestedTestType}
                </span>
              </div>
            )}
            {project.qaTestingNotes && (
              <div>
                <div className="text-xs text-purple-700 font-medium mb-1">Testing Notes:</div>
                <p className="text-sm text-purple-900 whitespace-pre-wrap">{project.qaTestingNotes}</p>
              </div>
            )}
            {project.qaAreasChanged && (
              <div>
                <div className="text-xs text-purple-700 font-medium mb-1">Areas Changed:</div>
                <p className="text-sm text-purple-900 whitespace-pre-wrap font-mono text-xs">{project.qaAreasChanged}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sign-off status banner */}
      {hasSignOff ? (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-green-800">
                ✓ Released — QA sign-off complete
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                Signed off by {signOff.signedOffBy.name} on {fmtDate(signOff.signedOffAt)}
                {signOff.qualityScore && ` · Quality score: ${signOff.qualityScore}/10`}
              </div>
              {signOff.releaseNotes && (
                <p className="text-xs text-green-700 mt-1">{signOff.releaseNotes}</p>
              )}
            </div>
            <Link href={`/projects/${project.id}`} className="text-xs text-green-700 hover:underline">
              View project →
            </Link>
          </div>
        </div>
      ) : isBlockingCycleResult(latestCycle?.result ?? '') ? (
        <div className={`mb-6 p-4 rounded-xl border ${
          latestCycle.result === 'blocked'
            ? 'bg-orange-50 border-orange-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className={`text-sm font-semibold ${
            latestCycle.result === 'blocked' ? 'text-orange-800' : 'text-red-800'
          }`}>
            {latestCycle.result === 'blocked' ? '⊘ Testing or release blocked' : '✕ Test cycle failed'}
          </div>
          {latestCycle.blockerNote && (
            <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">{latestCycle.blockerNote}</p>
          )}
          {devFixesReadyForRetest ? (
            <p className="text-xs text-green-700 mt-2 font-medium">
              Developer submitted fixes — re-test each case on the latest cycle below, then sign off when all pass.
            </p>
          ) : (
            <p className="text-xs text-red-500 mt-2">Waiting for dev to fix. Once fixed, re-test on the same cycle.</p>
          )}
        </div>
      ) : canSignOff ? (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="text-sm font-semibold text-amber-800">
            ⚡ Test cycle passed — submit sign-off to unlock delivery
          </div>
          <p className="text-xs text-amber-600 mt-1">
            Latest cycle: {latestCycle.cycleType.replace('_', ' ')} — {RESULT_CONFIG[latestCycle.result as keyof typeof RESULT_CONFIG]?.label}
          </p>
        </div>
      ) : (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="text-sm font-medium text-gray-600">
            No test cycle run yet. Log a test cycle before release.
          </div>
        </div>
      )}

      {/* Milestone approval */}
      <div className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Milestone Approval</h2>
        <MilestoneApproval
          milestones={project.milestones.map(m => ({
            ...m,
            testCases: m.testCases.map(serializeMilestoneTestCase),
            bugs: m.bugs.map(serializeMilestoneBug),
          }))}
          projectId={project.id}
          readOnly={!canManageQA}
        />
      </div>

      <TestCyclesPanel
        project={{ id: project.id, name: project.name, status: project.status }}
        members={members}
        milestones={project.milestones.map(m => ({
          id: m.id,
          title: m.title,
          status: m.status,
          dueDate: m.dueDate,
        }))}
        testCycles={project.testCycles.map(c => ({
          id: c.id,
          cycleType: c.cycleType,
          environment: c.environment,
          result: c.result,
          startedAt: c.startedAt.toISOString(),
          summary: c.summary,
          blockerNote: c.blockerNote,
          fixedInCycle: c.fixedInCycle,
          conductedById: c.conductedById,
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
        }))}
        hasSignOff={hasSignOff}
        canSignOff={canSignOff && canManageQA}
        canManage={canManageQA}
        latestCycleId={latestCycle?.id}
      />

      {/* Sign-off detail */}
      {hasSignOff && (
        <div className="card p-5 mb-4 bg-green-50 border-green-100">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Release sign-off detail</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { key: 'sanityPassed',        label: 'Sanity test passed' },
              { key: 'regressionPassed',    label: 'Regression passed' },
              { key: 'noBlockersOpen',      label: 'No open blockers' },
              { key: 'stagingMatchesLive',  label: 'Staging matches live' },
              { key: 'clientUATDone',       label: 'Client UAT done' },
              { key: 'knownIssuesAgreed',   label: 'Known issues agreed with client' },
            ].map(item => (
              <div key={item.key} className="flex items-center gap-2 text-sm">
                <span className={signOff[item.key as keyof typeof signOff] ? 'text-green-600' : 'text-red-500'}>
                  {signOff[item.key as keyof typeof signOff] ? '✓' : '✗'}
                </span>
                <span className="text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>
          {signOff.exceptionsNotes && (
            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
              Exceptions noted: {signOff.exceptionsNotes}
            </div>
          )}
        </div>
      )}

      {/* Post-delivery issues */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Post-delivery issues</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Issues the client reported after delivery. Not a bug tracker — log the ones we missed.
            </p>
          </div>
          {hasSignOff && canManageQA && (
            <QAProjectActions
              project={{ id: project.id, name: project.name, status: project.status }}
              members={members}
              canSignOff={false}
              latestCycleId={undefined}
              issueMode
              hasSignOff={hasSignOff}
            />
          )}
        </div>

        {project.postDeliveryIssues.length === 0 ? (
          <p className="text-sm text-green-700">No post-delivery issues reported. ✓</p>
        ) : (
          <div className="space-y-3">
            {project.postDeliveryIssues.map(issue => (
              <div key={issue.id} className={`p-3 rounded-lg border text-sm ${issue.resolvedAt ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge text-xs ${SEVERITY_CLS[issue.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                        {issue.severity}
                      </span>
                      <span className="text-xs text-gray-400">Reported by {issue.reportedBy} · {fmtDate(issue.reportedAt)}</span>
                      {issue.wasInScope === true && (
                        <span className="badge bg-red-100 text-red-700 text-xs">QA miss</span>
                      )}
                    </div>
                    <p className="text-gray-800">{issue.description}</p>
                    {issue.rootCause && (
                      <p className="text-xs text-gray-500 mt-1">Root cause: {issue.rootCause}</p>
                    )}
                    {issue.resolutionNotes && (
                      <p className="text-xs text-green-700 mt-1">✓ {issue.resolutionNotes}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {issue.resolvedAt
                      ? <span className="badge bg-green-100 text-green-700 text-xs">Resolved</span>
                      : <span className="badge bg-red-100 text-red-700 text-xs">Open</span>
                    }
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Trail */}
      <EntityAuditTrail
        entityType="Project"
        entityId={params.id}
        title="QA & Project History"
      />
    </div>
  )
}
