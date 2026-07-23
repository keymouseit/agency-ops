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

  const canEdit = ['testing', 'done', 'ready_for_qa'].includes(milestoneStatus)

  if (!canEdit) return null

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
    <div className="mt-4 pt-4 border-t border-gray-100">
      <h4 className="text-xs font-semibold text-gray-700 mb-2">Log bug</h4>

      {milestoneStatus === 'testing' && (
        <form onSubmit={logBug} className="space-y-2 mb-4">
          <input
            className="input text-sm w-full"
            placeholder="Bug title (e.g. Login button unresponsive on mobile)"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="input text-sm w-full"
            rows={2}
            placeholder="Steps to reproduce, expected vs actual behavior"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="input text-sm"
              value={severity}
              onChange={e => setSeverity(e.target.value)}
            >
              {BUG_SEVERITIES.map(s => (
                <option key={s} value={s}>{BUG_SEVERITY_CONFIG[s].label}</option>
              ))}
            </select>
            <button type="submit" disabled={adding || !title.trim()} className="btn-primary text-xs">
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
              <div key={bug.id} className="rounded-lg border border-gray-100 bg-white p-2.5">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`badge text-xs ${severityCfg.cls}`}>{severityCfg.label}</span>
                      <span className="text-sm font-medium text-gray-900">{bug.title}</span>
                      {linkedToTestCase && (
                        <span className="text-[10px] text-gray-400">auto from test case</span>
                      )}
                    </div>
                    {bug.description && (
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">{bug.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {bug.reportedBy.name} · {fmtDate(bug.reportedAt)}
                    </p>
                  </div>
                  {milestoneStatus === 'testing' && (
                    <select
                      value={bug.status}
                      disabled={loading === bug.id}
                      onChange={e => updateBug(bug.id, { status: e.target.value })}
                      className={`text-xs rounded border px-1.5 py-1 ${statusCfg.cls}`}
                    >
                      {BUG_STATUSES.map(s => (
                        <option key={s} value={s}>{BUG_STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                  )}
                  {milestoneStatus !== 'testing' && (
                    <span className={`badge text-xs ${statusCfg.cls}`}>{statusCfg.label}</span>
                  )}
                </div>
                {milestoneStatus === 'testing' && !linkedToTestCase && (
                  <button
                    type="button"
                    onClick={() => deleteBug(bug.id)}
                    disabled={loading === bug.id}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Delete
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bugs.length === 0 && milestoneStatus !== 'testing' && (
        <p className="text-xs text-gray-400">No bugs logged for this milestone.</p>
      )}
    </div>
  )
}
