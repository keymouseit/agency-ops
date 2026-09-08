'use client'

import { fmtDate } from '@/lib/utils'
import {
  QA_CHECKLIST_ITEMS,
  QA_CYCLE_RESULT_CONFIG,
  cycleSupportsBlockerNote,
  type SerializedTestCycleCase,
} from '@/lib/qa'
import TestCycleCasesList from '@/components/TestCycleCasesList'

export type TestCycleDetail = {
  id: string
  cycleType: string
  environment: string
  result: string
  startedAt: string | Date
  conductedById?: string
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
  cases: SerializedTestCycleCase[]
}

type Props = {
  cycle: TestCycleDetail
  isLatest?: boolean
  allowDevFix?: boolean
  allowQARetest?: boolean
  allowQAStatusEdit?: boolean
  headerActions?: React.ReactNode
  onClose: () => void
}

export default function TestCycleDetailModal({
  cycle,
  isLatest,
  allowDevFix,
  allowQARetest,
  allowQAStatusEdit,
  headerActions,
  onClose,
}: Props) {
  const cfg = QA_CYCLE_RESULT_CONFIG[cycle.result as keyof typeof QA_CYCLE_RESULT_CONFIG]
    ?? QA_CYCLE_RESULT_CONFIG.pending

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className={`px-6 py-4 border-b ${cfg.border} shrink-0`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`badge text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                <span className="text-xs text-gray-500 capitalize">{cycle.cycleType.replace(/_/g, ' ')}</span>
                <span className="text-xs text-gray-400">· {cycle.environment}</span>
                {isLatest && <span className="text-xs text-blue-600 font-medium">Latest</span>}
              </div>
              <div className="text-xs text-gray-400">
                By {cycle.conductedBy.name} · {fmtDate(cycle.startedAt)}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-5">
          {cycle.signOff && (
            <div className="text-xs text-green-700 font-medium bg-green-50 px-3 py-2 rounded-lg inline-block">
              ✓ Signed off by {cycle.signOff.signedOffBy.name}
            </div>
          )}

          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">What was tested</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QA_CHECKLIST_ITEMS.map(item => {
                const checked = cycle[item.key as keyof TestCycleDetail] === true
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
                      checked ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-400'
                    }`}
                  >
                    <span className={checked ? 'text-green-600' : 'text-gray-300'}>
                      {checked ? '✓' : '—'}
                    </span>
                    <span>{item.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {cycle.cases.length > 0 && (
            <TestCycleCasesList
              cases={cycle.cases}
              allowDevFix={allowDevFix}
              allowQARetest={allowQARetest}
              allowQAStatusEdit={allowQAStatusEdit}
            />
          )}

          {cycle.summary && (
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Overall notes</div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{cycle.summary}</p>
            </div>
          )}

          {cycleSupportsBlockerNote(cycle.result) && cycle.blockerNote && (
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="text-xs text-red-500 uppercase tracking-wide mb-0.5">Blocker</div>
              <p className="text-sm text-red-800 whitespace-pre-wrap">{cycle.blockerNote}</p>
            </div>
          )}

          {cycle.fixedInCycle && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="text-xs text-blue-500 uppercase tracking-wide mb-0.5">Fixed since last cycle</div>
              <p className="text-sm text-blue-800 whitespace-pre-wrap">{cycle.fixedInCycle}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
