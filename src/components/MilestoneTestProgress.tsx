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

type Props = {
  milestoneTitle: string
  milestoneStatus: string
  qaStartedAt?: string | null
  testCases: SerializedTestCase[]
  bugs?: SerializedBug[]
  compact?: boolean
}

export default function MilestoneTestProgress({
  milestoneTitle,
  milestoneStatus,
  qaStartedAt,
  testCases,
  bugs = [],
  compact = false,
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

      {(testCases.length > 0 || bugs.length > 0) && (
        <div className={`grid gap-2 mb-3 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4'}`}>
          <SummaryStat label="Test cases" value={summary.total} />
          <SummaryStat label="Completed" value={summary.completed} tone="green" />
          <SummaryStat label="Failed" value={summary.failed} tone={summary.failed > 0 ? 'red' : undefined} />
          {!compact && <SummaryStat label="Bugs" value={bugs.length} tone={openBugs > 0 ? 'red' : undefined} />}
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
          <div className="space-y-1.5 mb-4">
            {testCases.map(tc => {
              const cfg = TEST_CASE_STATUS_CONFIG[tc.status] ?? TEST_CASE_STATUS_CONFIG.pending
              return (
                <div
                  key={tc.id}
                  className={`flex items-start gap-2 text-xs rounded-lg px-2.5 py-2 ${
                    tc.status === 'fail' || tc.status === 'blocked'
                      ? 'bg-red-50'
                      : tc.status === 'pass'
                      ? 'bg-green-50/50'
                      : 'bg-gray-50'
                  }`}
                >
                  <span className={`badge shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-800 font-medium">{tc.title}</div>
                    {tc.notes && (
                      <p className="text-gray-500 mt-0.5 whitespace-pre-wrap">{tc.notes}</p>
                    )}
                    {tc.testedAt && tc.testedBy && (
                      <p className="text-gray-400 mt-0.5">
                        {tc.testedBy.name} · {fmtDate(tc.testedAt)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {bugs.length > 0 && (
        <>
          <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Bugs</h4>
          <div className="space-y-1.5">
            {bugs.map(bug => {
              const statusCfg = BUG_STATUS_CONFIG[bug.status] ?? BUG_STATUS_CONFIG.open
              const severityCfg = BUG_SEVERITY_CONFIG[bug.severity] ?? BUG_SEVERITY_CONFIG.medium
              return (
                <div
                  key={bug.id}
                  className={`rounded-lg px-2.5 py-2 text-xs border ${
                    bug.status === 'open' ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={`badge shrink-0 ${severityCfg.cls}`}>{severityCfg.label}</span>
                    <span className={`badge shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
                    <div className="flex-1 min-w-0 font-medium text-gray-800">{bug.title}</div>
                  </div>
                  {bug.description && (
                    <p className="text-gray-600 mt-1 whitespace-pre-wrap">{bug.description}</p>
                  )}
                  {bug.resolutionNotes && bug.status !== 'open' && (
                    <p className="text-green-700 mt-1 whitespace-pre-wrap">✓ {bug.resolutionNotes}</p>
                  )}
                  <p className="text-gray-400 mt-1">
                    {bug.reportedBy.name} · {fmtDate(bug.reportedAt)}
                    {bug.testCaseId && ' · from test case'}
                  </p>
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
