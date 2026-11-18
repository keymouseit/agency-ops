'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { fmtDate } from '@/lib/utils'
import {
  BUG_SEVERITIES,
  BUG_SEVERITY_CONFIG,
  BUG_STATUSES,
  BUG_STATUS_CONFIG,
  SerializedBug,
} from '@/lib/milestone-qa'
import SimpleSelect from '@/components/SimpleSelect'

export default function MilestoneBugEditor({
  milestoneId,
  milestoneStatus,
  bugs: initialBugs,
}: {
  milestoneId: string
  milestoneStatus: string
  bugs: SerializedBug[]
}) {
  const router = useRouter()
  const [bugs, setBugs] = useState(initialBugs)
  const [loading, setLoading] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [adding, setAdding] = useState(false)

  // Status can be changed while QA is working the milestone, after approval, or once it is sent back for fixes.
  const canChangeStatus = ['testing', 'done', 'ready_for_qa', 'in_progress'].includes(milestoneStatus)
  const canLogBugs = milestoneStatus === 'testing'

  if (!canChangeStatus) return null

  async function logBug(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description, severity }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to log bug')
      setBugs(prev => [data, ...prev])
      setTitle('')
      setDescription('')
      setSeverity('medium')
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to log bug')
    } finally {
      setAdding(false)
    }
  }

  async function updateBug(bugId: string, updates: Record<string, string>) {
    setLoading(bugId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs/${bugId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update bug')
      setBugs(prev => prev.map(b => (b.id === bugId ? data : b)))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update bug')
    } finally {
      setLoading(null)
    }
  }

  async function deleteBug(bugId: string) {
    if (!confirm('Delete this bug?')) return
    setLoading(bugId)
    try {
      const res = await fetch(`/api/projects/milestones/${milestoneId}/bugs/${bugId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete bug')
      setBugs(prev => prev.filter(b => b.id !== bugId))
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete bug')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 min-w-0">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Log bug</h4>

      {canLogBugs && (
        <form onSubmit={logBug} className="space-y-2 mb-4 min-w-0">
          <input
            className="input w-full"
            placeholder="Bug title (e.g. Login button unresponsive on mobile)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="input w-full"
            rows={2}
            placeholder="Steps to reproduce, expected vs actual behavior"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <SimpleSelect
                aria-label="Bug severity"
                value={severity}
                onChange={setSeverity}
                options={BUG_SEVERITIES.map(s => ({
                  value: s,
                  label: BUG_SEVERITY_CONFIG[s].label,
                }))}
              />
            </div>
            <button type="submit" disabled={adding || !title.trim()} className="btn-primary text-xs shrink-0">
              {adding ? 'Logging…' : 'Log bug'}
            </button>
          </div>
        </form>
      )}

      {bugs.length > 0 && (
        <div className="space-y-2">
          {bugs.map(bug => {
            const statusCfg = BUG_STATUS_CONFIG[bug.status] ?? BUG_STATUS_CONFIG.open
            const severityCfg = BUG_SEVERITY_CONFIG[bug.severity] ?? BUG_SEVERITY_CONFIG.medium
            const linkedToTestCase = !!bug.testCaseId

            return (
              <div key={bug.id} className="rounded-lg border border-gray-100 bg-white p-3 min-w-0 space-y-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`badge text-xs ${severityCfg.cls}`}>{severityCfg.label}</span>
                    <span className="text-sm font-medium text-gray-900 break-words">{bug.title}</span>
                    {linkedToTestCase && (
                      <span className="text-[10px] text-gray-400">auto from test case</span>
                    )}
                  </div>
                  {bug.description && (
                    <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">{bug.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 break-words">
                    {bug.reportedBy.name} · {fmtDate(bug.reportedAt)}
                  </p>
                </div>
                {canChangeStatus ? (
                  loading === bug.id ? (
                    <div
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500"
                      role="status"
                      aria-live="polite"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin"
                        aria-hidden="true"
                      />
                      Saving…
                    </div>
                  ) : (
                    <div className="w-full min-w-0 sm:max-w-[11rem]">
                      <SimpleSelect
                        value={bug.status}
                        onChange={v => updateBug(bug.id, { status: v })}
                        aria-label={`Status for ${bug.title}`}
                        options={BUG_STATUSES.map(s => ({
                          value: s,
                          label: BUG_STATUS_CONFIG[s].label,
                        }))}
                      />
                    </div>
                  )
                ) : (
                  <span className={`badge text-xs ${statusCfg.cls}`}>{statusCfg.label}</span>
                )}
                {canLogBugs && !linkedToTestCase && (
                  <button
                    type="button"
                    onClick={() => deleteBug(bug.id)}
                    disabled={loading === bug.id}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bugs.length === 0 && !canLogBugs && (
        <p className="text-xs text-gray-400">No bugs logged for this milestone.</p>
      )}
    </div>
  )
}
