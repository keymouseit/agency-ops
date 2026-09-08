'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import MilestoneTestCaseEditor from './MilestoneTestCaseEditor'
import MilestoneBugEditor from './MilestoneBugEditor'
import MilestoneTestProgress from '@/components/MilestoneTestProgress'
import { openBugCount } from '@/lib/milestone-qa'

type TestCase = {
  id: string
  title: string
  status: string
  notes: string | null
  testedAt: string | null
  testedBy: { name: string } | null
}

type Bug = {
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
}

type Milestone = {
  id: string
  title: string
  dueDate: Date
  status: string
  completedAt: Date | null
  qaStartedAt: Date | null
  testCases: TestCase[]
  bugs: Bug[]
}

export default function MilestoneApproval({
  milestones,
  projectId,
  readOnly = false,
}: {
  milestones: Milestone[]
  projectId: string
  readOnly?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function toggleMilestone(milestoneId: string, currentStatus: string) {
    setLoading(milestoneId)
    try {
      const newStatus = currentStatus === 'done' ? 'testing' : 'done'
      const res = await fetch(`/api/projects/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update milestone')
      }

      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update milestone')
    } finally {
      setLoading(null)
    }
  }

  if (milestones.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        No milestones defined for this project.
      </div>
    )
  }

  const approvedCount = milestones.filter(m => m.status === 'done').length
  const testingCount = milestones.filter(m => m.status === 'testing').length
  const readyForQACount = milestones.filter(m => m.status === 'ready_for_qa').length
  const pendingCount = milestones.filter(m => m.status === 'pending').length
  const progressPct = Math.round((approvedCount / milestones.length) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">
          {approvedCount} of {milestones.length} milestones approved
          {testingCount > 0 && (
            <span className="ml-2 text-teal-600 font-medium">
              · {testingCount} in testing
            </span>
          )}
          {readyForQACount > 0 && (
            <span className="ml-2 text-blue-600 font-medium">
              · {readyForQACount} ready to test
            </span>
          )}
          {pendingCount > 0 && (
            <span className="ml-2 text-gray-400">
              · {pendingCount} pending dev
            </span>
          )}
        </div>
        <div className={`text-sm font-semibold ${
          progressPct >= 80 ? 'text-green-600' :
          progressPct >= 50 ? 'text-amber-600' :
          'text-gray-500'
        }`}>
          {progressPct}%
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${
            progressPct >= 80 ? 'bg-green-500' :
            progressPct >= 50 ? 'bg-amber-400' :
            progressPct >= 25 ? 'bg-blue-500' :
            'bg-gray-400'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-2">
        {milestones.map(m => {
          const isOverdue = new Date(m.dueDate) < new Date() && m.status !== 'done'
          const isReadyForQA = m.status === 'ready_for_qa'
          const isTesting = m.status === 'testing'
          const isPending = m.status === 'pending'
          const isExpanded = expanded === m.id
          const openBugs = openBugCount(m.bugs)
          const canToggleApproval = m.status === 'testing' || m.status === 'done'

          return (
            <div
              key={m.id}
              className={`rounded-lg border ${
                m.status === 'done'
                  ? 'bg-green-50 border-green-200'
                  : isTesting
                  ? 'bg-teal-50 border-teal-200'
                  : isReadyForQA
                  ? 'bg-blue-50 border-blue-200'
                  : isPending
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : isOverdue
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                {!readOnly ? (
                  <input
                    type="checkbox"
                    data-testid="milestone-checkbox"
                    checked={m.status === 'done'}
                    onChange={() => toggleMilestone(m.id, m.status)}
                    disabled={loading === m.id || isPending || !canToggleApproval}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-30"
                    title={
                      isPending
                        ? 'Waiting for developer to mark as ready for QA'
                        : !canToggleApproval
                        ? 'Start testing before approving'
                        : 'Toggle QA approval'
                    }
                  />
                ) : (
                  <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                    m.status === 'done' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-200 text-transparent'
                  }`}>
                    ✓
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${
                    m.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {m.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                    <span>Due: {fmtDate(m.dueDate)}</span>
                    {isPending && (
                      <span className="badge bg-gray-100 text-gray-500">Waiting for dev</span>
                    )}
                    {isReadyForQA && (
                      <span className="badge bg-blue-100 text-blue-700">Ready to test</span>
                    )}
                    {isTesting && (
                      <span className="badge bg-teal-100 text-teal-800">
                        In testing{m.testCases.length > 0 ? ` · ${m.testCases.length} cases` : ''}
                      </span>
                    )}
                    {openBugs > 0 && (
                      <span className="badge bg-red-100 text-red-700">{openBugs} open bug(s)</span>
                    )}
                    {isOverdue && <span className="text-red-600">⚠ Overdue</span>}
                    {m.completedAt && (
                      <span className="text-green-600">✓ Approved {fmtDate(m.completedAt)}</span>
                    )}
                  </div>
                </div>
                {(isTesting || m.status === 'done' || isReadyForQA) && (
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : m.id)}
                    className="text-xs text-gray-500 hover:text-gray-800 shrink-0"
                  >
                    {isExpanded ? 'Hide cases' : 'Test cases'}
                  </button>
                )}
                {loading === m.id && (
                  <div className="text-xs text-gray-400 shrink-0">Updating...</div>
                )}
              </div>

              {isExpanded && (
                <div className="px-3 pb-3">
                  {readOnly ? (
                    <MilestoneTestProgress
                      milestoneTitle={m.title}
                      milestoneStatus={m.status}
                      qaStartedAt={m.qaStartedAt?.toISOString() ?? null}
                      testCases={m.testCases}
                      bugs={m.bugs}
                    />
                  ) : (
                    <>
                      <MilestoneTestCaseEditor
                        key={`${m.id}-${m.status}`}
                        milestoneId={m.id}
                        milestoneStatus={m.status}
                        testCases={m.testCases}
                      />
                      <MilestoneBugEditor
                        milestoneId={m.id}
                        milestoneStatus={m.status}
                        bugs={m.bugs}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        {readOnly
          ? 'Expand a milestone to review test cases and bugs logged by QA.'
          : 'Start testing on ready milestones, log test cases and bugs, then approve when complete. Failed test cases auto-create bugs for the developer.'}
      </p>
    </div>
  )
}
