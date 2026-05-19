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

  const completedCount = milestones.filter(m => m.status === 'done').length
  const progressPct = Math.round((completedCount / milestones.length) * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">
          {completedCount} of {milestones.length} milestones approved
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

          return (
            <label
              key={m.id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                m.status === 'done'
                  ? 'bg-green-50 border-green-200'
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
                disabled={loading === m.id}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  m.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}>
                  {m.title}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Due: {fmtDate(m.dueDate)}
                  {isOverdue && <span className="text-red-600 ml-2">⚠ Overdue</span>}
                  {m.completedAt && (
                    <span className="text-green-600 ml-2">
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
        ℹ️ Check milestones as QA-approved. Project progress is calculated from approved milestones.
      </p>
    </div>
  )
}
