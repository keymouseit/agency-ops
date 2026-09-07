'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import MilestoneTestProgress from '@/components/MilestoneTestProgress'
import MilestoneBugFixActions from '@/components/MilestoneBugFixActions'
import { openBugCount, SerializedBug } from '@/lib/milestone-qa'

type TestCase = {
  id: string
  title: string
  status: string
  notes: string | null
  testedAt: string | null
  testedBy: { name: string } | null
}

type Milestone = {
  id: string
  title: string
  dueDate: Date
  status: string
  completedAt: Date | null
  qaStartedAt?: string | null
  testCases?: TestCase[]
  bugs?: SerializedBug[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string }> = {
  pending: {
    label: 'Not Started',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200'
  },
  ready_for_qa: {
    label: 'Ready for QA',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  },
  testing: {
    label: 'In testing',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200'
  },
  done: {
    label: 'QA Approved',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
}

export default function DeveloperMilestones({
  milestones,
  projectId
}: {
  milestones: Milestone[]
  projectId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function updateMilestoneStatus(milestoneId: string, newStatus: string) {
    setLoading(milestoneId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update milestone')
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

  const readyForQACount = milestones.filter(m => m.status === 'ready_for_qa').length
  const testingCount = milestones.filter(m => m.status === 'testing').length
  const approvedCount = milestones.filter(m => m.status === 'done').length
  const progressPct = Math.round((approvedCount / milestones.length) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">
          {approvedCount} of {milestones.length} QA-approved
          {testingCount > 0 && (
            <span className="ml-2 text-teal-600">
              · {testingCount} in testing
            </span>
          )}
          {readyForQACount > 0 && (
            <span className="ml-2 text-blue-600">
              · {readyForQACount} ready for QA
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
          const statusConfig = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending
          const isOverdue = new Date(m.dueDate) < new Date() && m.status !== 'done'
          const testCases = m.testCases ?? []
          const bugs = m.bugs ?? []
          const canExpand = ['ready_for_qa', 'testing', 'done'].includes(m.status)
          const isExpanded = expanded === m.id
          const openBugs = openBugCount(bugs)

          return (
            <div
              key={m.id}
              className={`rounded-lg border ${statusConfig.borderColor} ${statusConfig.bgColor}`}
            >
              <div
                className={`p-3 flex items-start justify-between gap-3 ${
                  canExpand ? 'cursor-pointer select-none' : ''
                }`}
                onClick={canExpand ? () => setExpanded(isExpanded ? null : m.id) : undefined}
                onKeyDown={canExpand ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setExpanded(isExpanded ? null : m.id)
                  }
                } : undefined}
                role={canExpand ? 'button' : undefined}
                tabIndex={canExpand ? 0 : undefined}
                aria-expanded={canExpand ? isExpanded : undefined}
              >
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${
                    m.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'
                  }`}>
                    {m.title}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                    <span>Due: {fmtDate(m.dueDate)}</span>
                    {isOverdue && <span className="text-red-600">⚠ Overdue</span>}
                    {openBugs > 0 && (
                      <span className="text-red-600 font-medium">{openBugs} open bug(s)</span>
                    )}
                    {m.completedAt && (
                      <span className="text-green-600">
                        ✓ Approved {fmtDate(m.completedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={e => e.stopPropagation()}
                >
                  <span className={`badge text-xs ${statusConfig.color} ${statusConfig.bgColor}`}>
                    {statusConfig.label}
                  </span>
                  {canExpand && (
                    <span className="text-gray-400 text-sm w-4 text-center" aria-hidden>
                      {isExpanded ? '▾' : '▸'}
                    </span>
                  )}
                  {loading === m.id ? (
                    <span className="text-xs text-gray-400">Updating...</span>
                  ) : (
                    <div className="flex gap-1">
                      {m.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => updateMilestoneStatus(m.id, 'ready_for_qa')}
                          className="btn-secondary text-xs py-1 px-2"
                          title="Mark as ready for QA testing"
                        >
                          → Send to QA
                        </button>
                      )}
                      {m.status === 'ready_for_qa' && (
                        <button
                          type="button"
                          onClick={() => updateMilestoneStatus(m.id, 'pending')}
                          className="btn-secondary text-xs py-1 px-2"
                          title="Move back to pending"
                        >
                          ← Not Ready
                        </button>
                      )}
                      {m.status === 'done' && (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-3">
                <MilestoneTestProgress
                  milestoneTitle={m.title}
                  milestoneStatus={m.status}
                  qaStartedAt={m.qaStartedAt}
                  testCases={testCases}
                  bugs={bugs}
                />
                <MilestoneBugFixActions milestoneId={m.id} bugs={bugs} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Mark milestones as &quot;Ready for QA&quot; when complete. Click a milestone row to see test summary and bugs.
      </p>
    </div>
  )
}
