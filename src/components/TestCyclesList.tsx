'use client'

import { useState } from 'react'
import { fmtDate } from '@/lib/utils'
import { QA_CYCLE_RESULT_CONFIG, hasFailingTestCases, isBlockingCycleResult } from '@/lib/qa'
import TestCycleDetailModal, { type TestCycleDetail } from '@/components/TestCycleDetailModal'

type Props = {
  testCycles: TestCycleDetail[]
  projectId?: string
  hasSignOff?: boolean
  manageButtons?: (cycle: TestCycleDetail, isLatest: boolean, closeModal: () => void) => React.ReactNode
  allowDevFix?: boolean
  allowQAManage?: boolean
}

export default function TestCyclesList({
  testCycles,
  hasSignOff = false,
  manageButtons,
  allowDevFix = false,
  allowQAManage = false,
}: Props) {
  const [viewingCycleId, setViewingCycleId] = useState<string | null>(null)

  const viewingCycle = viewingCycleId
    ? testCycles.find(c => c.id === viewingCycleId) ?? null
    : null
  const viewingIndex = viewingCycle
    ? testCycles.findIndex(c => c.id === viewingCycle.id)
    : -1

  if (testCycles.length === 0) {
    return <p className="text-sm text-gray-400">No test cycles logged yet for this project.</p>
  }

  return (
    <>
      <div className="space-y-3">
        {testCycles.map((cycle, i) => {
          const cfg = QA_CYCLE_RESULT_CONFIG[cycle.result as keyof typeof QA_CYCLE_RESULT_CONFIG]
            ?? QA_CYCLE_RESULT_CONFIG.pending
          const isLatest = i === 0
          const passed = cycle.cases.filter(c => c.status === 'pass' || c.status === 'skipped').length
          const failed = cycle.cases.filter(c => c.status === 'fail').length
          const blocked = cycle.cases.filter(c => c.status === 'blocked').length
          const checkedCount = [
            cycle.testedAuth,
            cycle.testedCoreFlows,
            cycle.testedEdgeCases,
            cycle.testedMobile,
            cycle.testedCrossBrowser,
            cycle.testedPerformance,
            cycle.testedIntegrations,
            cycle.testedDataIntegrity,
          ].filter(Boolean).length

          return (
            <div
              key={cycle.id}
              className={`rounded-xl border p-4 transition-colors ${cfg.border} ${
                isLatest ? '' : 'opacity-80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left hover:opacity-90"
                  onClick={() => setViewingCycleId(cycle.id)}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`badge text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    <span className="text-xs text-gray-500 capitalize">{cycle.cycleType.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-gray-400">· {cycle.environment}</span>
                    {isLatest && <span className="text-xs text-blue-600 font-medium">Latest</span>}
                  </div>
                  <div className="text-xs text-gray-400 mb-2">
                    By {cycle.conductedBy.name} · {fmtDate(cycle.startedAt)}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    {cycle.cases.length > 0 && (
                      <span>
                        {passed}/{cycle.cases.length} test cases passed
                        {failed > 0 && <span className="text-red-600"> · {failed} failed</span>}
                        {blocked > 0 && <span className="text-orange-600"> · {blocked} blocked</span>}
                      </span>
                    )}
                    {checkedCount > 0 && <span>{checkedCount} areas tested</span>}
                    {cycle.summary && (
                      <span className="text-gray-400 truncate max-w-md block sm:inline">
                        {cycle.summary.split('\n')[0]}
                        {cycle.summary.includes('\n') ? '…' : ''}
                      </span>
                    )}
                  </div>
                </button>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {cycle.signOff && (
                    <div className="text-xs text-green-700 font-medium bg-green-50 px-2 py-1 rounded">
                      ✓ Signed off
                    </div>
                  )}
                  {manageButtons?.(cycle, isLatest, () => setViewingCycleId(null))}
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() => setViewingCycleId(cycle.id)}
                  >
                    View details →
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {viewingCycle && (
        <TestCycleDetailModal
          cycle={viewingCycle}
          isLatest={viewingIndex === 0}
          allowDevFix={
            allowDevFix
            && viewingIndex === 0
            && (isBlockingCycleResult(viewingCycle.result) || hasFailingTestCases(viewingCycle.cases))
          }
          allowQARetest={allowQAManage && !hasSignOff && viewingIndex === 0}
          allowQAStatusEdit={allowQAManage && !hasSignOff && viewingIndex === 0}
          headerActions={manageButtons?.(viewingCycle, viewingIndex === 0, () => setViewingCycleId(null))}
          onClose={() => setViewingCycleId(null)}
        />
      )}
    </>
  )
}
