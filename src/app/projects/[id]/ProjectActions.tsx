'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; name: string }
type Project = { id: string; status: string; postMortem: unknown }

export default function ProjectActions({ project, members }: { project: Project; members: Member[] }) {
  const [view, setView] = useState<'scope'|'checkin'|'milestone'|'postmortem'|'status'|null>(null)
  const [loading, setLoading] = useState(false)
  const [statusError, setStatusError] = useState('')
  const router = useRouter()

  async function submitForm(e: React.FormEvent<HTMLFormElement>, url: string) {
    e.preventDefault()
    setLoading(true)
    setStatusError('')
    const fd = new FormData(e.currentTarget)
    const data = Object.fromEntries(fd)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }))
      setStatusError(err.error ?? 'Something went wrong.')
      setLoading(false)
      return
    }
    setLoading(false)
    setView(null)
    router.refresh()
  }

  const isActive = ['scoping', 'active', 'qa'].includes(project.status)

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {isActive && <button className="btn-secondary text-xs" onClick={() => setView('checkin')}>+ Weekly check-in</button>}
        {isActive && <button className="btn-secondary text-xs" onClick={() => setView('scope')}>+ Scope change</button>}
        {isActive && <button className="btn-secondary text-xs" onClick={() => setView('milestone')}>+ Milestone</button>}
        {!project.postMortem && <button className="btn-secondary text-xs" onClick={() => setView('postmortem')}>+ Post-mortem</button>}
        <button className="btn-secondary text-xs" onClick={() => setView('status')}>Update status</button>
      </div>

      {view === 'checkin' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Weekly check-in</h3>
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/checkin`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Submitted by</label>
                <select name="submittedById" required className="input">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Progress (%)</label>
                <input name="progressPct" type="number" min="0" max="100" required className="input" placeholder="0–100" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">On track?</label>
                <select name="onTrack" className="input">
                  <option value="yes">Yes</option>
                  <option value="at_risk">At risk</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label className="label">Scope change?</label>
                <select name="scopeChange" className="input">
                  <option value="none">None</option>
                  <option value="logged">Logged with CO</option>
                  <option value="unlogged">Unlogged ⚠</option>
                </select>
              </div>
              <div>
                <label className="label">Client updated?</label>
                <select name="clientUpdated" className="input">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Blockers (if any)</label>
              <input name="blockers" className="input" placeholder="What's blocking you?" />
            </div>
            <div>
              <label className="label">Estimate drift (hours over/under)</label>
              <input name="estimateDrift" type="number" className="input" placeholder="e.g. 15 if 15 hours over" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Submit'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'scope' && (
        <div className="card p-5 border-amber-100">
          <h3 className="text-sm font-semibold mb-1">Log scope change</h3>
          <p className="text-xs text-amber-700 mb-3">Every scope change must be logged here. No exceptions — regardless of client pressure.</p>
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/scope`)} className="space-y-3">
            <div>
              <label className="label">Description *</label>
              <textarea name="description" rows={2} required className="input" placeholder="What changed? Be specific." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Requested by</label>
                <select name="requestedBy" className="input">
                  <option value="client">Client</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
              <div>
                <label className="label">Hours added</label>
                <input name="hoursAdded" type="number" className="input" />
              </div>
              <div>
                <label className="label">Value added (USD)</label>
                <input name="valueAdded" type="number" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Change order signed?</label>
                <select name="changeOrderSigned" className="input">
                  <option value="false">No — pending</option>
                  <option value="true">Yes — signed</option>
                </select>
              </div>
              <div>
                <label className="label">Approved by</label>
                <select name="approvedById" className="input">
                  <option value="">— Not yet —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Log scope change'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'milestone' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Add milestone</h3>
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/milestones`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Title *</label>
                <input name="title" required className="input" placeholder="e.g. Design approved" />
              </div>
              <div>
                <label className="label">Due date *</label>
                <input name="dueDate" type="date" required className="input" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Add'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'postmortem' && (
        <div className="card p-5 bg-blue-50 border-blue-100">
          <h3 className="text-sm font-semibold mb-1 text-blue-900">Post-mortem</h3>
          <p className="text-xs text-blue-700 mb-3">Required within 1 week of delivery. Be honest.</p>
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/postmortem`)} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Est. accuracy (actual/est %)</label>
                <input name="estimationAccuracy" type="number" step="0.01" className="input" placeholder="e.g. 1.42" />
              </div>
              <div>
                <label className="label">Client satisfaction (1–10)</label>
                <input name="clientSatisfaction" type="number" min="1" max="10" className="input" />
              </div>
              <div>
                <label className="label">On time?</label>
                <select name="onTime" className="input">
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">What worked well?</label>
              <textarea name="whatWorked" rows={2} className="input" />
            </div>
            <div>
              <label className="label">What broke / went wrong?</label>
              <textarea name="whatBroke" rows={2} className="input" />
            </div>
            <div>
              <label className="label">Root cause</label>
              <textarea name="rootCause" rows={1} className="input" />
            </div>
            <div>
              <label className="label">Prevention actions (what changes next time)</label>
              <textarea name="preventionAction" rows={2} className="input" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Save post-mortem'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'status' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Update project status</h3>
          {statusError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              ⛔ {statusError}
            </div>
          )}
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/status`)} className="flex gap-2">
            <select name="status" defaultValue={project.status} className="input flex-1">
              {['scoping','active','qa','delivered','cancelled'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Update'}</button>
            <button type="button" className="btn-secondary" onClick={() => { setView(null); setStatusError('') }}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  )
}
