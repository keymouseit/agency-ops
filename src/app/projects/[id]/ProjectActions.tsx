'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@/lib/utils'

type Member = { id: string; name: string; role?: string }
type Project = {
  id: string
  status: string
  postMortem: unknown
  bdMemberId?: string | null
  developerId?: string
  releaseSignOff?: unknown
}

function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
      {message}
    </div>
  )
}

export default function ProjectActions({ project, members, userRole }: { project: Project; members: Member[]; userRole?: string }) {
  const [view, setView] = useState<'scope'|'checkin'|'milestone'|'postmortem'|'status'|'assignbd'|'assigndev'|null>(null)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(project.status)
  const router = useRouter()

  async function submitForm(e: React.FormEvent<HTMLFormElement>, url: string) {
    e.preventDefault()
    setLoading(true)
    setFormError('')
    const fd = new FormData(e.currentTarget)
    let data: any = Object.fromEntries(fd)

    // If changing to QA status, validate and structure the QA handoff data
    if (url.includes('/status') && data.status === 'qa') {
      // Validate required QA handoff fields
      if (!data.qaModulesDelivered || !data.qaModulesDelivered.trim()) {
        setFormError('QA Handoff: "Modules/Features delivered" is required')
        setLoading(false)
        return
      }
      if (!data.qaSuggestedTestType) {
        setFormError('QA Handoff: "Suggested test type" is required')
        setLoading(false)
        return
      }

      data = {
        status: data.status,
        qaHandoff: {
          modulesDelivered: data.qaModulesDelivered || '',
          suggestedTestType: data.qaSuggestedTestType || '',
          testingNotes: data.qaTestingNotes || '',
          areasChanged: data.qaAreasChanged || '',
        }
      }
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setFormError(err.error ?? `Request failed (${res.status}).`)
        setLoading(false)
        return
      }
      setLoading(false)
      setFormError('')
      setView(null)
      setSelectedStatus(project.status)
      router.refresh()
    } catch {
      setFormError('Network error — could not reach the server. Please try again.')
      setLoading(false)
    }
  }

  const isActive = ['scoping', 'active', 'qa'].includes(project.status)
  const canAddPostMortem = (project.status === 'qa' && !!project.releaseSignOff) || project.status === 'delivered'
  const canAssignBD = ['Founder', 'Manager'].includes(userRole || '')
  const canAssignDeveloper = ['Founder', 'Manager', 'BD', 'Both'].includes(userRole || '')

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap mt-[20px]">
        {isActive && <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('checkin') }}>+ Weekly check-in</button>}
        {isActive && <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('scope') }}>+ Scope change</button>}
        {isActive && <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('milestone') }}>+ Milestone</button>}
        {canAddPostMortem && !project.postMortem && <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('postmortem') }}>+ Post-mortem</button>}
        <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('status') }}>Update status</button>
        {canAssignBD && <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('assignbd') }}>{project.bdMemberId ? 'Change BD' : 'Assign BD'}</button>}
        {canAssignDeveloper && <button className="btn-secondary text-xs" onClick={() => { setFormError(''); setView('assigndev') }}>Change assigned person</button>}
      </div>

      {view === 'checkin' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Weekly check-in</h3>
          <FormError message={formError} />
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
              <button type="button" className="btn-secondary" onClick={() => { setFormError(''); setView(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'scope' && (
        <div className="card p-5 border-amber-100">
          <h3 className="text-sm font-semibold mb-1">Log scope change</h3>
          <p className="text-xs text-amber-700 mb-3">Every scope change is sent to the assigned BD and Founder for approval before the developer proceeds.</p>
          <FormError message={formError} />
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
                <label className="label">Value added (USD) {userRole === 'Dev' && <span className="text-xs text-gray-400">(Founder/BD only)</span>}</label>
                <input
                  name="valueAdded"
                  type="number"
                  className="input"
                  disabled={userRole === 'Dev'}
                  title={userRole === 'Dev' ? 'Only Founders and BD can set monetary values' : ''}
                />
              </div>
            </div>
            <div>
              <label className="label">Change order signed?</label>
              <select name="changeOrderSigned" className="input">
                <option value="false">No - pending</option>
                <option value="true">Yes - signed</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Log scope change'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setFormError(''); setView(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'milestone' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Add milestone</h3>
          <FormError message={formError} />
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
              <button type="button" className="btn-secondary" onClick={() => { setFormError(''); setView(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'postmortem' && (
        <div className="card p-5 bg-blue-50 border-blue-100">
          <h3 className="text-sm font-semibold mb-1 text-blue-900">Post-mortem</h3>
          <p className="text-xs text-blue-700 mb-3">Required within 1 week of delivery. Be honest.</p>
          <FormError message={formError} />
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
              <button type="button" className="btn-secondary" onClick={() => { setFormError(''); setView(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'status' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Update project status</h3>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/status`)} className="space-y-3">
            <div className="flex gap-2">
              <select
                name="status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input flex-1"
              >
                {PROJECT_STATUSES
                  .filter(s => {
                    // Devs cannot set project to cancelled or delivered manually
                    if (userRole === 'Dev' && (s === 'cancelled' || s === 'delivered')) return false
                    return true
                  })
                  .map(s => (
                    <option key={s} value={s}>{PROJECT_STATUS_LABELS[s] ?? s}</option>
                  ))}
              </select>
            </div>
            {userRole === 'Dev' && (
              <p className="text-xs text-gray-500">
                Note: Projects move to 'delivered' automatically after QA sign-off. Contact manager to cancel a project.
              </p>
            )}

            {selectedStatus === 'qa' && (
              <div className="space-y-3 p-4 bg-purple-50 border border-purple-100 rounded-lg">
                <p className="text-xs text-purple-900 font-medium mb-2">
                  📋 QA Handoff — Help QA understand what to test
                </p>
                <div>
                  <label className="label">Modules/Features delivered *</label>
                  <textarea
                    name="qaModulesDelivered"
                    rows={2}
                    required
                    className="input"
                    placeholder="e.g., User authentication, Payment integration, Admin dashboard"
                  />
                </div>
                <div>
                  <label className="label">Suggested test type *</label>
                  <select name="qaSuggestedTestType" required className="input">
                    <option value="">— Select —</option>
                    <option value="sanity">Sanity (quick smoke test)</option>
                    <option value="regression">Full regression</option>
                    <option value="specific">Specific module testing</option>
                    <option value="full">Full comprehensive test</option>
                  </select>
                </div>
                <div>
                  <label className="label">Testing notes/instructions</label>
                  <textarea
                    name="qaTestingNotes"
                    rows={2}
                    className="input"
                    placeholder="Edge cases to check, special scenarios, login credentials, etc."
                  />
                </div>
                <div>
                  <label className="label">Areas changed (files/components)</label>
                  <textarea
                    name="qaAreasChanged"
                    rows={2}
                    className="input"
                    placeholder="e.g., src/auth/*, components/payment/*, api/users/*"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Update'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setView(null); setFormError(''); setSelectedStatus(project.status) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'assignbd' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">{project.bdMemberId ? 'Change BD (Client Manager)' : 'Assign BD (Client Manager)'}</h3>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/assign-bd`)} className="space-y-3">
            <div>
              <label className="label">BD Member</label>
              <select name="bdMemberId" className="input" defaultValue={project.bdMemberId || ''}>
                <option value="">No BD assigned</option>
                {members.filter(m => ['BD', 'Both', 'Founder'].includes(m.role || '')).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Save'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setFormError(''); setView(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'assigndev' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Change assigned person</h3>
          <p className="text-xs text-gray-500 mb-3">
            Reassign the project owner. The new assignee will get a notification.
          </p>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/assign-developer`)} className="space-y-3">
            <div>
              <label className="label">Assigned person</label>
              <select name="developerId" className="input" defaultValue={project.developerId || ''} required>
                <option value="">Select person...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.role ? ` · ${m.role}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Save'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setFormError(''); setView(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
