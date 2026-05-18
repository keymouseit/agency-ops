import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import QAProjectActions from './QAProjectActions'
import EntityAuditTrail from '@/components/EntityAuditTrail'

export const dynamic = 'force-dynamic'

const RESULT_CONFIG = {
  pass:        { label: 'Pass ✓',         cls: 'bg-green-100 text-green-800',  border: 'border-green-200' },
  fail:        { label: 'Fail — blocked', cls: 'bg-red-100 text-red-800',      border: 'border-red-200' },
  conditional: { label: 'Conditional',   cls: 'bg-amber-100 text-amber-800',   border: 'border-amber-200' },
  pending:     { label: 'In progress',   cls: 'bg-blue-100 text-blue-800',     border: 'border-blue-100' },
}

const SEVERITY_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high:     'bg-orange-100 text-orange-800',
  medium:   'bg-amber-100 text-amber-800',
  low:      'bg-gray-100 text-gray-600',
}

const CHECKLIST_ITEMS = [
  { key: 'testedAuth',          label: 'Authentication & permissions' },
  { key: 'testedCoreFlows',     label: 'Core user flows (happy paths)' },
  { key: 'testedEdgeCases',     label: 'Edge cases & error states' },
  { key: 'testedMobile',        label: 'Mobile / responsive' },
  { key: 'testedCrossBrowser',  label: 'Cross-browser' },
  { key: 'testedPerformance',   label: 'Performance' },
  { key: 'testedIntegrations',  label: '3rd party integrations' },
  { key: 'testedDataIntegrity', label: 'Data integrity & persistence' },
]

export default async function QAProjectPage({ params }: { params: { id: string } }) {
  const [project, members] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      include: {
        developer: true,
        testCycles: {
          orderBy: { startedAt: 'desc' },
          include: { conductedBy: true, signOff: { include: { signedOffBy: true } } },
        },
        releaseSignOff: { include: { signedOffBy: true } },
        postDeliveryIssues: { orderBy: { reportedAt: 'desc' } },
      },
    }),
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ])

  if (!project) notFound()

  const latestCycle = project.testCycles[0]
  const signOff = project.releaseSignOff
  const canSignOff = latestCycle?.result === 'pass' || latestCycle?.result === 'conditional'
  const hasSignOff = !!signOff

  return (
    <div className="max-w-3xl">
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
      ) : latestCycle?.result === 'fail' ? (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="text-sm font-semibold text-red-800">⛔ Release blocked</div>
          {latestCycle.blockerNote && (
            <p className="text-sm text-red-700 mt-1">{latestCycle.blockerNote}</p>
          )}
          <p className="text-xs text-red-500 mt-2">Fix the blocker, then run another test cycle.</p>
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

      {/* Test cycle history */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">Test cycles</h2>
          {!hasSignOff && (
            <QAProjectActions
              project={{ id: project.id, name: project.name, status: project.status }}
              members={members}
              canSignOff={canSignOff}
              latestCycleId={latestCycle?.id}
            />
          )}
        </div>

        {project.testCycles.length === 0 ? (
          <p className="text-sm text-gray-400">No test cycles logged yet for this project.</p>
        ) : (
          <div className="space-y-4">
            {project.testCycles.map((cycle, i) => {
              const cfg = RESULT_CONFIG[cycle.result as keyof typeof RESULT_CONFIG] ?? RESULT_CONFIG.pending
              const checkedItems = CHECKLIST_ITEMS.filter(item =>
                cycle[item.key as keyof typeof cycle] === true
              )
              return (
                <div key={cycle.id} className={`rounded-xl border p-4 ${cfg.border} ${i === 0 ? '' : 'opacity-70'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-500 capitalize">{cycle.cycleType.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-400">· {cycle.environment}</span>
                        {i === 0 && <span className="text-xs text-blue-600 font-medium">Latest</span>}
                      </div>
                      <div className="text-xs text-gray-400">
                        By {cycle.conductedBy.name} · {fmtDate(cycle.startedAt)}
                      </div>
                    </div>
                    {cycle.signOff && (
                      <div className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded">
                        ✓ Signed off
                      </div>
                    )}
                  </div>

                  {/* What was tested */}
                  {checkedItems.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1.5">Tested</div>
                      <div className="flex flex-wrap gap-1.5">
                        {checkedItems.map(item => (
                          <span key={item.key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            ✓ {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {cycle.summary && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Report summary</div>
                      <p className="text-sm text-gray-700">{cycle.summary}</p>
                    </div>
                  )}

                  {/* Blocker */}
                  {cycle.blockerNote && (
                    <div className="mt-2 p-2.5 bg-red-50 rounded-lg">
                      <div className="text-xs text-red-500 uppercase tracking-wide mb-0.5">Blocker</div>
                      <p className="text-sm text-red-800">{cycle.blockerNote}</p>
                    </div>
                  )}

                  {/* What dev fixed */}
                  {cycle.fixedInCycle && (
                    <div className="mt-2 p-2.5 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-500 uppercase tracking-wide mb-0.5">Fixed since last cycle</div>
                      <p className="text-sm text-blue-800">{cycle.fixedInCycle}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
          {hasSignOff && (
            <QAProjectActions
              project={{ id: project.id, name: project.name, status: project.status }}
              members={members}
              canSignOff={false}
              latestCycleId={undefined}
              issueMode
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
