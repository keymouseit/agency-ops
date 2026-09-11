'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import MilestoneTestCaseEditor from './MilestoneTestCaseEditor'
import MilestoneBugEditor from './MilestoneBugEditor'
import MilestoneTestProgress from '@/components/MilestoneTestProgress'
import { allTestCasesPassed, MILESTONE_STATUS_CONFIG, openBugCount } from '@/lib/milestone-qa'

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
  dueDate: Date | null
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

  async function setMilestoneStatus(milestoneId: string, status: 'done' | 'testing' | 'in_progress') {
    setLoading(milestoneId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
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
  const inProgressCount = milestones.filter(m => m.status === 'in_progress').length
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
              · {readyForQACount} in QA
            </span>
          )}
          {inProgressCount > 0 && (
            <span className="ml-2 text-amber-700">
              · {inProgressCount} in progress
            </span>
          )}
          {pendingCount > 0 && (
            <span className="ml-2 text-gray-400">
              · {pendingCount} not started
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
          const isOverdue = !!m.dueDate && new Date(m.dueDate) < new Date() && m.status !== 'done'
          const isReadyForQA = m.status === 'ready_for_qa'
          const isTesting = m.status === 'testing'
          const isInProgress = m.status === 'in_progress'
          const isPending = m.status === 'pending'
          const isExpanded = expanded === m.id
          const openBugs = openBugCount(m.bugs)
          const allPassed = allTestCasesPassed(m.testCases)
          const canApprove = isTesting && allPassed
          const canReturnToInProgress = isReadyForQA || isTesting
          const isApproved = m.status === 'done'
          const doneCfg = MILESTONE_STATUS_CONFIG.done

          return (
            <div
              key={m.id}
              className={`rounded-lg border ${
                isApproved
                  ? 'bg-green-50 border-green-200'
                  : isTesting
                  ? 'bg-teal-50 border-teal-200'
                  : isReadyForQA
                  ? 'bg-blue-50 border-blue-200'
                  : isInProgress
                  ? 'bg-amber-50 border-amber-200'
                  : isPending
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : isOverdue
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${
                    isApproved ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {m.title}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                    {m.dueDate ? <span>Due: {fmtDate(m.dueDate)}</span> : <span>No due date</span>}
                    {isPending && (
                      <span className="badge bg-gray-100 text-gray-500">Not started</span>
                    )}
                    {isInProgress && (
                      <span className="badge bg-amber-100 text-amber-800">In progress</span>
                    )}
                    {isReadyForQA && (
                      <span className="badge bg-blue-100 text-blue-700">In QA</span>
                    )}
                    {isTesting && (
                      <span className="badge bg-teal-100 text-teal-800">
                        In testing{m.testCases.length > 0 ? ` · ${m.testCases.length} cases` : ''}
                      </span>
                    )}
                    {isApproved && (
                      <span className={`badge ${doneCfg.cls}`}>{doneCfg.label}</span>
                    )}
                    {openBugs > 0 && (
                      <span className="badge bg-red-100 text-red-700">{openBugs} open bug(s)</span>
                    )}
                    {isOverdue && <span className="text-red-600">⚠ Overdue</span>}
                    {m.completedAt && (
                      <span className="text-green-600">✓ {fmtDate(m.completedAt)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!readOnly && canApprove && (
                    <button
                      type="button"
                      data-testid="milestone-approve"
                      onClick={() => setMilestoneStatus(m.id, 'done')}
                      disabled={loading === m.id}
                      className="btn-primary text-xs py-1.5 px-3"
                    >
                      {loading === m.id ? 'Approving…' : 'Approve'}
                    </button>
                  )}
                  {!readOnly && canReturnToInProgress && (
                    <button
                      type="button"
                      data-testid="milestone-return-in-progress"
                      onClick={() => setMilestoneStatus(m.id, 'in_progress')}
                      disabled={loading === m.id}
                      className="btn-secondary text-xs py-1.5 px-3"
                      title="Send this milestone back to the developer as In progress"
                    >
                      {loading === m.id ? 'Updating…' : '← In progress'}
                    </button>
                  )}
                  {!readOnly && isApproved && (
                    <button
                      type="button"
                      data-testid="milestone-unapprove"
                      onClick={() => setMilestoneStatus(m.id, 'testing')}
                      disabled={loading === m.id}
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      {loading === m.id ? 'Updating…' : 'Undo'}
                    </button>
                  )}
                  {(isTesting || isApproved || isReadyForQA) && (
                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : m.id)}
                      className="text-xs text-gray-500 hover:text-gray-800"
                    >
                      {isExpanded ? 'Hide cases' : 'Test cases'}
                    </button>
                  )}
                  {loading === m.id && !canApprove && !isApproved && !canReturnToInProgress && (
                    <div className="text-xs text-gray-400">Updating...</div>
                  )}
                </div>
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
          : 'Start testing on ready milestones, mark all test cases as Pass, then Approve the milestone. Failed test cases auto-create bugs for the developer.'}
      </p>
    </div>
  )
}
