'use client'

import { useState } from 'react'
import { fmtDate } from '@/lib/utils'
import {
  BUG_SEVERITY_CONFIG,
  BUG_STATUS_CONFIG,
  MILESTONE_STATUS_CONFIG,
  SerializedBug,
  SerializedTestCase,
  TEST_CASE_STATUS_CONFIG,
  milestoneHasTestingVisibility,
  openBugCount,
  testCaseSummary,
} from '@/lib/milestone-qa'
import MilestoneBugWorkflow from '@/components/MilestoneBugWorkflow'

type Props = {
  milestoneTitle: string
  milestoneStatus: string
  qaStartedAt?: string | null
  testCases: SerializedTestCase[]
  bugs?: SerializedBug[]
  compact?: boolean
  milestoneId?: string
  canFix?: boolean
  canReview?: boolean
}

function BugRow({
  bug,
  milestoneId,
  canFix,
  canReview,
}: {
  bug: SerializedBug
  milestoneId?: string
  canFix?: boolean
  canReview?: boolean
}) {
  const statusCfg = BUG_STATUS_CONFIG[bug.status] ?? BUG_STATUS_CONFIG.open
  const severityCfg = BUG_SEVERITY_CONFIG[bug.severity] ?? BUG_SEVERITY_CONFIG.medium
  const links = bug.attachmentUrls?.length
    ? bug.attachmentUrls
    : bug.attachmentUrl
      ? [bug.attachmentUrl]
      : []

  return (
    <div
      className={`rounded-md px-2 py-1.5 text-xs border ${
        bug.status === 'open'
          ? 'bg-red-50 border-red-100'
          : bug.status === 'fixed'
            ? 'bg-emerald-50 border-emerald-100'
            : 'bg-gray-50 border-gray-100'
      }`}
    >
      <div className="flex items-start gap-2 flex-wrap">
        {bug.displayId && (
          <span className="font-mono text-[10px] font-semibold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
            {bug.displayId}
          </span>
        )}
        <span className={`badge shrink-0 ${severityCfg.cls}`}>{severityCfg.label}</span>
        <span className={`badge shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
        <div className="flex-1 min-w-0 font-medium text-gray-800">{bug.title}</div>
      </div>
      {bug.stepsToReproduce && (
        <p className="text-gray-600 mt-1 whitespace-pre-wrap">
          <span className="font-medium text-gray-700">Steps: </span>
          {bug.stepsToReproduce}
        </p>
      )}
      {bug.description && (
        <p className="text-gray-600 mt-1 whitespace-pre-wrap">{bug.description}</p>
      )}
      {links.map((url, i) => (
        <a
          key={`${bug.id}-att-${i}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-700 hover:underline mt-1 block"
        >
          {links.length > 1 ? `Link ${i + 1}` : 'View attachment'}
        </a>
      ))}
      {bug.resolutionNotes && bug.status !== 'open' && (
        <p className="text-green-700 mt-1 whitespace-pre-wrap">✓ {bug.resolutionNotes}</p>
      )}
      <p className="text-gray-400 mt-1">
        {bug.reportedBy.name} · {fmtDate(bug.reportedAt)}
      </p>
      {milestoneId && (canFix || canReview) && (
        <MilestoneBugWorkflow
          milestoneId={milestoneId}
          bug={bug}
          canFix={!!canFix}
          canReview={!!canReview}
        />
      )}
    </div>
  )
}

export default function MilestoneTestProgress({
  milestoneTitle,
  milestoneStatus,
  qaStartedAt,
  testCases,
  bugs = [],
  compact = false,
  milestoneId,
  canFix = false,
  canReview = false,
}: Props) {
  if (!milestoneHasTestingVisibility(milestoneStatus, testCases.length, bugs.length)) {
    if (milestoneStatus === 'ready_for_qa') {
      return (
        <p className="text-xs text-blue-600 mt-2">Awaiting QA to start testing.</p>
      )
    }
    return null
  }

  const summary = testCaseSummary(testCases)
  const statusCfg = MILESTONE_STATUS_CONFIG[milestoneStatus] ?? MILESTONE_STATUS_CONFIG.pending
  const openBugs = openBugCount(bugs)
  const linkedBugs = bugs.filter(b => b.testCaseId && testCases.some(tc => tc.id === b.testCaseId))

  const [openCaseIds, setOpenCaseIds] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const tc of testCases) {
      const caseBugs = bugs.filter(b => b.testCaseId === tc.id)
      const hasOpenOrFixed = caseBugs.some(b => b.status === 'open' || b.status === 'fixed')
      if (hasOpenOrFixed || tc.status === 'fail' || tc.status === 'blocked') {
        initial.add(tc.id)
      }
    }
    // If nothing needs attention, open the first case so the accordion is discoverable
    if (initial.size === 0 && testCases[0]) initial.add(testCases[0].id)
    return initial
  })

  function toggleCase(id: string) {
    setOpenCaseIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className={`mt-3 ${compact ? '' : 'pt-3 border-t border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`badge text-xs ${statusCfg.cls}`}>{statusCfg.label}</span>
          {qaStartedAt && (
            <span className="text-xs text-gray-400">Testing since {fmtDate(qaStartedAt)}</span>
          )}
        </div>
        {openBugs > 0 && (
          <span className="badge text-xs bg-red-100 text-red-800">{openBugs} open bug(s)</span>
        )}
      </div>

      {(testCases.length > 0 || linkedBugs.length > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-4">
          <SummaryStat label="Test cases" value={summary.total} />
          <SummaryStat label="Completed" value={summary.completed} tone="green" />
          <SummaryStat label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'red' : undefined} />
          <SummaryStat label="Bugs" value={linkedBugs.length} tone={openBugs > 0 ? 'red' : undefined} />
        </div>
      )}

      {testCases.length > 0 && (
        <>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all ${
                summary.failed > 0 ? 'bg-amber-400' : summary.pct >= 100 ? 'bg-green-500' : 'bg-teal-500'
              }`}
              style={{ width: `${summary.pct}%` }}
            />
          </div>

          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Test cases</h4>
          <div className="space-y-2 mb-4">
            {testCases.map(tc => {
              const cfg = TEST_CASE_STATUS_CONFIG[tc.status] ?? TEST_CASE_STATUS_CONFIG.pending
              const caseBugs = bugs.filter(b => b.testCaseId === tc.id)
              const isOpen = openCaseIds.has(tc.id)
              const panelId = `testcase-panel-${tc.id}`

              return (
                <div
                  key={tc.id}
                  className={`rounded-lg text-xs border overflow-hidden ${
                    tc.status === 'fail' || tc.status === 'blocked'
                      ? 'bg-red-50 border-red-100'
                      : tc.status === 'pass'
                      ? 'bg-green-50/50 border-green-100'
                      : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCase(tc.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-black/[0.02]"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className={`badge shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                    {tc.displayId && (
                      <span className="font-mono text-[10px] font-semibold text-teal-800 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded shrink-0">
                        {tc.displayId}
                      </span>
                    )}
                    <span className="text-gray-800 font-medium truncate flex-1 min-w-0">{tc.title}</span>
                    {caseBugs.length > 0 && (
                      <span className="text-[10px] font-medium text-gray-500 shrink-0">
                        {caseBugs.length} bug{caseBugs.length === 1 ? '' : 's'}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {isOpen ? 'Close' : 'Open'}
                    </span>
                  </button>

                  {isOpen && (
                    <div id={panelId} className="px-2.5 pb-2.5 border-t border-black/[0.04]">
                      {tc.notes && (
                        <p className="text-gray-500 mt-2 whitespace-pre-wrap">{tc.notes}</p>
                      )}
                      {tc.testedAt && tc.testedBy && (
                        <p className="text-gray-400 mt-1">
                          {tc.testedBy.name} · {fmtDate(tc.testedAt)}
                        </p>
                      )}
                      {caseBugs.length > 0 ? (
                        <div className="mt-2 ml-1 pl-2 border-l-2 border-red-200 space-y-1.5">
                          {caseBugs.map(bug => (
                            <BugRow
                              key={bug.id}
                              bug={bug}
                              milestoneId={milestoneId}
                              canFix={canFix}
                              canReview={canReview}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 mt-2">No bugs logged under this case.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {milestoneStatus === 'testing' && testCases.length === 0 && bugs.length === 0 && (
        <p className="text-xs text-teal-700">QA has started testing — test cases and bugs will appear here shortly.</p>
      )}

      {!compact && milestoneTitle && testCases.length === 0 && bugs.length === 0 && milestoneStatus === 'done' && (
        <p className="text-xs text-gray-400">Approved without logged test cases or bugs.</p>
      )}
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'green' | 'red'
}) {
  return (
    <div className="rounded-lg bg-white/80 border border-gray-100 px-2.5 py-2 text-center">
      <div className={`text-lg font-semibold ${
        tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-gray-900'
      }`}>
        {value}
      </div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</div>
    </div>
  )
}
