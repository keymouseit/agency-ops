import Link from 'next/link'
import { fmtDate } from '@/lib/utils'
import { formatQAActivitySummary } from '@/lib/qa-audit'
import type { QAEventType } from '@/lib/qa-audit-format'

export type QAActivityLog = {
  id: string
  entityId: string | null
  entityName: string | null
  userName: string | null
  timestamp: Date | string
  metadata: string | null
}

const EVENT_STYLES: Record<string, { icon: string; box: string; label: string }> = {
  test_cycle_logged: { icon: '✓', box: 'bg-green-100', label: 'Test cycle' },
  test_cycle_updated: { icon: '✏️', box: 'bg-blue-100', label: 'Test cycle' },
  test_cycle_deleted: { icon: '🗑', box: 'bg-gray-100', label: 'Test cycle' },
  test_cycle_case_dev_fix: { icon: '🔧', box: 'bg-amber-100', label: 'Dev fix' },
  test_cycle_case_retest: { icon: '🔁', box: 'bg-teal-100', label: 'Re-test' },
  release_signoff: { icon: '🎉', box: 'bg-green-100', label: 'Sign-off' },
  milestone_created: { icon: '📌', box: 'bg-green-100', label: 'Milestone' },
  milestone_started: { icon: '▶️', box: 'bg-amber-100', label: 'Milestone' },
  milestone_ready_for_qa: { icon: '📥', box: 'bg-blue-100', label: 'Milestone' },
  milestone_testing_started: { icon: '🔍', box: 'bg-teal-100', label: 'Milestone' },
  milestone_test_case_added: { icon: '➕', box: 'bg-gray-100', label: 'Test case' },
  milestone_test_case_updated: { icon: '📝', box: 'bg-amber-100', label: 'Test case' },
  milestone_approved: { icon: '✅', box: 'bg-green-100', label: 'Milestone' },
  milestone_status_changed: { icon: '↔️', box: 'bg-purple-100', label: 'Milestone' },
  milestone_updated: { icon: '✏️', box: 'bg-blue-100', label: 'Milestone' },
  milestone_deleted: { icon: '🗑', box: 'bg-red-100', label: 'Milestone' },
  milestone_bug_fixed: { icon: '🐛', box: 'bg-amber-100', label: 'Bug fix' },
}

const DEFAULT_STYLE = { icon: '•', box: 'bg-gray-100', label: 'Activity' }

function getEventStyle(qaEventType: string | undefined) {
  if (!qaEventType) return DEFAULT_STYLE
  return EVENT_STYLES[qaEventType] ?? DEFAULT_STYLE
}

export default function QATestingActivityList({
  logs,
  emptyMessage = 'No testing activity recorded yet.',
}: {
  logs: QAActivityLog[]
  emptyMessage?: string
}) {
  const items = logs
    .map(log => {
      const metadata = log.metadata ? JSON.parse(log.metadata) : null
      const summary = formatQAActivitySummary(metadata)
      if (!summary) return null
      const style = getEventStyle(metadata?.qaEventType as QAEventType | undefined)
      return { log, summary, style, metadata }
    })
    .filter(Boolean) as Array<{
    log: QAActivityLog
    summary: string
    style: (typeof EVENT_STYLES)[string]
    metadata: Record<string, unknown> | null
  }>

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100 text-xl">
          🔍
        </div>
        <p className="text-sm font-medium text-gray-700">{emptyMessage}</p>
        <p className="text-xs text-gray-400 mt-1">
          Test cycles, milestone reviews, and sign-offs will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden divide-y divide-gray-100">
      {items.map(({ log, summary, style }) => (
        <div key={log.id} className="px-4 py-3.5 flex items-start gap-3 hover:bg-gray-50/80 transition-colors">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm shrink-0 ${style.box}`}
          >
            {style.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {style.label}
              </span>
            </div>
            <p className="text-sm text-gray-900 leading-snug">{summary}</p>
            <p className="text-xs text-gray-500 mt-1">
              {log.entityName && <span className="font-medium text-gray-700">{log.entityName}</span>}
              {log.userName && (
                <>
                  {log.entityName && ' · '}
                  {log.userName}
                </>
              )}
              {' · '}
              {fmtDate(log.timestamp)}
            </p>
          </div>
          {log.entityId && (
            <Link
              href={`/qa/${log.entityId}`}
              className="btn-secondary text-xs px-2.5 py-1.5 shrink-0 self-center"
            >
              View →
            </Link>
          )}
        </div>
      ))}
    </div>
  )
}
