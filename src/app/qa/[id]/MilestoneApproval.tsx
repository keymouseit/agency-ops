'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'

type Milestone = {
  id: string
  title: string
  dueDate: Date
  status: string
  completedAt: Date | null
}

export default function MilestoneApproval({
  milestones,
  projectId
}: {
  milestones: Milestone[]
  projectId: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function toggleMilestone(milestoneId: string, currentStatus: string) {
    setLoading(milestoneId)
    try {
      const newStatus = currentStatus === 'done' ? 'pending' : 'done'
      const res = await fetch(`/api/projects/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) {
        throw new Error('Failed to update milestone')
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
  const readyForQACount = milestones.filter(m => m.status === 'ready_for_qa').length
  const pendingCount = milestones.filter(m => m.status === 'pending').length
  const progressPct = Math.round((approvedCount / milestones.length) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">
          {approvedCount} of {milestones.length} milestones approved
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
          const isPending = m.status === 'pending'

          return (
            <label
              key={m.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                m.status === 'done'
                  ? 'bg-green-50 border-green-200'
                  : isReadyForQA
                  ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
                  : isPending
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : isOverdue
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <input
                type="checkbox"
                data-testid="milestone-checkbox"
                checked={m.status === 'done'}
                onChange={() => toggleMilestone(m.id, m.status)}
                disabled={loading === m.id || isPending}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-30"
                title={isPending ? 'Waiting for developer to mark as ready for QA' : 'Toggle QA approval'}
              />
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  m.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}>
                  {m.title}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <span>Due: {fmtDate(m.dueDate)}</span>
                  {isPending && (
                    <span className="badge bg-gray-100 text-gray-500">
                      Waiting for dev
                    </span>
                  )}
                  {isReadyForQA && !m.completedAt && (
                    <span className="badge bg-blue-100 text-blue-700">
                      Ready to test
                    </span>
                  )}
                  {isOverdue && <span className="text-red-600">⚠ Overdue</span>}
                  {m.completedAt && (
                    <span className="text-green-600">
                      ✓ Approved {fmtDate(m.completedAt)}
                    </span>
                  )}
                </div>
              </div>
              {loading === m.id && (
                <div className="text-xs text-gray-400">Updating...</div>
              )}
            </label>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        ℹ️ Check milestones to approve them after testing. Blue badges indicate milestones ready for QA. Gray milestones are still in development.
      </p>
    </div>
  )
}
