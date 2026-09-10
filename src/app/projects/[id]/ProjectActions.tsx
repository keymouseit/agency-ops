'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@/lib/utils'
import AssigneeMultiSelect from '../AssigneeMultiSelect'

type Member = { id: string; name: string; role?: string }
type Project = {
  id: string
  status: string
  postMortem: unknown
  bdMemberId?: string | null
  developerId?: string
  assigneeIds?: string[]
  releaseSignOff?: unknown
}

type ActionView =
  | 'scope'
  | 'checkin'
  | 'milestone'
  | 'postmortem'
  | 'status'
  | 'assignbd'
  | 'assigndev'
  | null

function FormError({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
      {message}
    </div>
  )
}

function ActionModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {description ? <p className="text-xs text-gray-500 mt-1">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export default function ProjectActions({
  project,
  members,
  userRole,
}: {
  project: Project
  members: Member[]
  userRole?: string
}) {
  const [view, setView] = useState<ActionView>(null)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(project.status)
  const router = useRouter()

  function open(next: ActionView) {
    setFormError('')
    setSelectedStatus(project.status)
    setView(next)
  }

  function close() {
    setFormError('')
    setView(null)
    setSelectedStatus(project.status)
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>, url: string) {
    e.preventDefault()
    setLoading(true)
    setFormError('')
    const fd = new FormData(e.currentTarget)
    let data: Record<string, unknown> = Object.fromEntries(fd)

    if (url.includes('/status') && data.status === 'qa') {
      if (!data.qaModulesDelivered || !String(data.qaModulesDelivered).trim()) {
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
        },
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
      close()
      softRefresh(router)
    } catch {
      setFormError('Network error — could not reach the server. Please try again.')
      setLoading(false)
    }
  }

  const isActive = ['scoping', 'active', 'qa'].includes(project.status)
  const canAddPostMortem = (project.status === 'qa' && !!project.releaseSignOff) || project.status === 'delivered'
  const canAssignBD = ['Founder', 'Manager'].includes(userRole || '')
  const canAssignDeveloper = ['Founder', 'Manager', 'BD', 'Both'].includes(userRole || '')

  const btn =
    'inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap'
  const btnPrimary =
    'inline-flex items-center rounded-full bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800 whitespace-nowrap'

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {isActive && (
          <button type="button" className={btnPrimary} onClick={() => open('milestone')}>
            + Milestone
          </button>
        )}
        {isActive && (
          <button type="button" className={btn} onClick={() => open('checkin')}>
            + Check-in
          </button>
        )}
        {isActive && (
          <button type="button" className={btn} onClick={() => open('scope')}>
            + Scope
          </button>
        )}
        {canAddPostMortem && !project.postMortem && (
          <button type="button" className={btn} onClick={() => open('postmortem')}>
            + Post-mortem
          </button>
        )}
        <button type="button" className={btn} onClick={() => open('status')}>
          Status
        </button>
        {canAssignBD && (
          <button type="button" className={btn} onClick={() => open('assignbd')}>
            {project.bdMemberId ? 'BD' : 'Assign BD'}
          </button>
        )}
        {canAssignDeveloper && (
          <button type="button" className={btn} onClick={() => open('assigndev')}>
            Assigned
          </button>
        )}
      </div>

      {view === 'checkin' && (
        <ActionModal title="Weekly check-in" onClose={close}>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/checkin`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Submitted by</label>
                <select name="submittedById" required className="input">
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
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
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Submit'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}

      {view === 'scope' && (
        <ActionModal
          title="Log scope change"
          description="Every scope change is sent to the assigned BD and Founder for approval."
          onClose={close}
        >
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
                <label className="label">
                  Value added (USD){' '}
                  {userRole === 'Dev' && <span className="text-xs text-gray-400">(Founder/BD only)</span>}
                </label>
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
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Log scope change'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}

      {view === 'milestone' && (
        <ActionModal title="Add milestone" onClose={close}>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/milestones`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Title *</label>
                <input name="title" required className="input" placeholder="e.g. Design approved" />
              </div>
              <div>
                <label className="label">Due date</label>
                <input name="dueDate" type="date" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Details</label>
              <textarea
                name="notes"
                rows={4}
                className="input"
                placeholder="Describe the scope of this milestone…"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Add'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}

      {view === 'postmortem' && (
        <ActionModal
          title="Post-mortem"
          description="Required within 1 week of delivery. Be honest."
          onClose={close}
        >
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
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Save post-mortem'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}

      {view === 'status' && (
        <ActionModal title="Update project status" onClose={close}>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/status`)} className="space-y-3">
            <div>
              <select
                name="status"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="input"
              >
                {PROJECT_STATUSES.filter(s => {
                  if (userRole === 'Dev' && (s === 'cancelled' || s === 'delivered')) return false
                  return true
                }).map(s => (
                  <option key={s} value={s}>
                    {PROJECT_STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
            {userRole === 'Dev' && (
              <p className="text-xs text-gray-500">
                Note: Projects move to delivered automatically after QA sign-off. Contact manager to cancel a project.
              </p>
            )}

            {selectedStatus === 'qa' && (
              <div className="space-y-3 p-4 bg-purple-50 border border-purple-100 rounded-lg">
                <p className="text-xs text-purple-900 font-medium mb-2">
                  QA Handoff — Help QA understand what to test
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

            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Update'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}

      {view === 'assignbd' && (
        <ActionModal
          title={project.bdMemberId ? 'Change BD (Client Manager)' : 'Assign BD (Client Manager)'}
          onClose={close}
        >
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/assign-bd`)} className="space-y-3">
            <div>
              <label className="label">BD Member</label>
              <select name="bdMemberId" className="input" defaultValue={project.bdMemberId || ''}>
                <option value="">No BD assigned</option>
                {members
                  .filter(m => ['BD', 'Both', 'Founder'].includes(m.role || ''))
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Save'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}

      {view === 'assigndev' && (
        <ActionModal title="Change assigned people" onClose={close}>
          <p className="text-xs text-gray-500 mb-3">
            Select one or more people for this project. Newly added people get a notification.
          </p>
          <FormError message={formError} />
          <form
            onSubmit={async e => {
              e.preventDefault()
              setLoading(true)
              setFormError('')
              const fd = new FormData(e.currentTarget)
              const developerIds = fd.getAll('developerIds').filter((id): id is string => typeof id === 'string')
              if (!developerIds.length) {
                setFormError('Select at least one person.')
                setLoading(false)
                return
              }
              try {
                const res = await fetch(`/api/projects/${project.id}/assign-developer`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ developerIds }),
                })
                if (!res.ok) {
                  const err = await res.json().catch(() => ({ error: 'Unknown error' }))
                  setFormError(err.error ?? `Request failed (${res.status}).`)
                  setLoading(false)
                  return
                }
                setLoading(false)
                close()
                softRefresh(router)
              } catch {
                setFormError('Network error — could not reach the server. Please try again.')
                setLoading(false)
              }
            }}
            className="space-y-3"
          >
            <div>
              <label className="label">Assigned people</label>
              <AssigneeMultiSelect
                members={members}
                defaultOpen
                selectedIds={
                  project.assigneeIds?.length
                    ? project.assigneeIds
                    : project.developerId
                      ? [project.developerId]
                      : []
                }
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Save'}
              </button>
              <button type="button" className="btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </ActionModal>
      )}
    </>
  )
}
