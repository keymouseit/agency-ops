'use client'
import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from '@/lib/utils'
import AssigneeMultiSelect from '../AssigneeMultiSelect'
import BodyScrollLock from '@/components/BodyScrollLock'
import SimpleSelect from '@/components/SimpleSelect'

const btn =
  'inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap'
const btnPrimary =
  'btn-primary inline-flex items-center justify-center text-xs !px-3 !py-2 whitespace-nowrap'

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
          <BodyScrollLock />
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 shrink-0">
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
        <div className="p-5 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  )
}

export default function ProjectActions({
  project,
  members,
  userRole,
  trailing,
}: {
  project: Project
  members: Member[]
  userRole?: string
  /** Edit / Delete (or other) actions rendered in the same toolbar. */
  trailing?: ReactNode
}) {
  const [view, setView] = useState<ActionView>(null)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState(project.status)
  const [checkinSubmittedBy, setCheckinSubmittedBy] = useState(members[0]?.id ?? '')
  const [checkinOnTrack, setCheckinOnTrack] = useState('yes')
  const [checkinScopeChange, setCheckinScopeChange] = useState('none')
  const [checkinClientUpdated, setCheckinClientUpdated] = useState('true')
  const [bdMemberId, setBdMemberId] = useState(project.bdMemberId || '')
  const [scopeRequestedBy, setScopeRequestedBy] = useState('client')
  const [scopeChangeOrderSigned, setScopeChangeOrderSigned] = useState('false')
  const [postMortemOnTime, setPostMortemOnTime] = useState('true')
  const [postMortemSatisfaction, setPostMortemSatisfaction] = useState('')
  const [qaSuggestedTestType, setQaSuggestedTestType] = useState('')
  const router = useRouter()

  function open(next: ActionView) {
    setFormError('')
    setSelectedStatus(project.status)
    if (next === 'checkin') {
      setCheckinSubmittedBy(members[0]?.id ?? '')
      setCheckinOnTrack('yes')
      setCheckinScopeChange('none')
      setCheckinClientUpdated('true')
    }
    if (next === 'scope') {
      setScopeRequestedBy('client')
      setScopeChangeOrderSigned('false')
    }
    if (next === 'assignbd') {
      setBdMemberId(project.bdMemberId || '')
    }
    if (next === 'postmortem') {
      setPostMortemOnTime('true')
      setPostMortemSatisfaction('')
    }
    if (next === 'status') {
      setQaSuggestedTestType('')
    }
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

  return (
    <>
      <div className="w-full min-w-0 space-y-2">
        {(isActive || (canAddPostMortem && !project.postMortem)) && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
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
          </div>
        )}
        <div className="flex flex-wrap gap-2 sm:justify-end">
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
          {trailing}
        </div>
      </div>

      {view === 'checkin' && (
        <ActionModal title="Weekly check-in" onClose={close}>
          <FormError message={formError} />
          <form onSubmit={e => submitForm(e, `/api/projects/${project.id}/checkin`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="min-w-0">
                <label className="label">Submitted by</label>
                <SimpleSelect
                  name="submittedById"
                  required
                  aria-label="Submitted by"
                  value={checkinSubmittedBy}
                  onChange={setCheckinSubmittedBy}
                  options={members.map(m => ({ value: m.id, label: m.name }))}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Progress (%)</label>
                <input name="progressPct" type="number" min="0" max="100" required className="input" placeholder="0–100" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight min-h-[2.5rem] flex items-end">
                  On track?
                </span>
                <SimpleSelect
                  name="onTrack"
                  aria-label="On track"
                  value={checkinOnTrack}
                  onChange={setCheckinOnTrack}
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'at_risk', label: 'At risk' },
                    { value: 'no', label: 'No' },
                  ]}
                />
              </div>
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight min-h-[2.5rem] flex items-end">
                  Scope change?
                </span>
                <SimpleSelect
                  name="scopeChange"
                  aria-label="Scope change"
                  value={checkinScopeChange}
                  onChange={setCheckinScopeChange}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'logged', label: 'Logged with CO' },
                    { value: 'unlogged', label: 'Unlogged ⚠' },
                  ]}
                />
              </div>
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight min-h-[2.5rem] flex items-end">
                  Client updated?
                </span>
                <SimpleSelect
                  name="clientUpdated"
                  aria-label="Client updated"
                  value={checkinClientUpdated}
                  onChange={setCheckinClientUpdated}
                  options={[
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                  ]}
                />
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
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight min-h-[2.5rem] flex items-end">
                  Requested by
                </span>
                <SimpleSelect
                  name="requestedBy"
                  aria-label="Requested by"
                  value={scopeRequestedBy}
                  onChange={setScopeRequestedBy}
                  options={[
                    { value: 'client', label: 'Client' },
                    { value: 'internal', label: 'Internal' },
                  ]}
                />
              </div>
              <div className="min-w-0 flex flex-col gap-1">
                <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight min-h-[2.5rem] flex items-end">
                  Hours added
                </span>
                <input name="hoursAdded" type="number" className="input" />
              </div>
              <div className="min-w-0 flex flex-col gap-1">
                <span
                  className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight min-h-[2.5rem] flex items-end"
                  title={userRole === 'Dev' ? 'Only Founders and BD can set monetary values' : undefined}
                >
                  Value (USD)
                </span>
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
              <SimpleSelect
                name="changeOrderSigned"
                aria-label="Change order signed?"
                value={scopeChangeOrderSigned}
                onChange={setScopeChangeOrderSigned}
                options={[
                  { value: 'false', label: 'No - pending' },
                  { value: 'true', label: 'Yes - signed' },
                ]}
              />
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:items-end">
              <div className="min-w-0">
                <label className="label">Est. accuracy</label>
                <input
                  name="estimationAccuracy"
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="actual/est · e.g. 1.42"
                />
              </div>
              <div className="min-w-0">
                <label className="label">Satisfaction (1–10)</label>
                <SimpleSelect
                  name="clientSatisfaction"
                  aria-label="Client satisfaction"
                  placeholder="Select…"
                  value={postMortemSatisfaction}
                  onChange={setPostMortemSatisfaction}
                  options={[
                    { value: '', label: 'Select…' },
                    ...Array.from({ length: 10 }, (_, i) => {
                      const n = String(i + 1)
                      return { value: n, label: n }
                    }),
                  ]}
                />
              </div>
              <div className="min-w-0">
                <label className="label">On time?</label>
                <SimpleSelect
                  name="onTime"
                  aria-label="On time"
                  value={postMortemOnTime}
                  onChange={setPostMortemOnTime}
                  options={[
                    { value: 'true', label: 'Yes' },
                    { value: 'false', label: 'No' },
                  ]}
                />
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
              <SimpleSelect
                name="status"
                aria-label="Project status"
                value={selectedStatus}
                onChange={setSelectedStatus}
                options={PROJECT_STATUSES.filter(s => {
                  if (userRole === 'Dev' && (s === 'cancelled' || s === 'delivered')) return false
                  return true
                }).map(s => ({ value: s, label: PROJECT_STATUS_LABELS[s] ?? s }))}
              />
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
                  <SimpleSelect
                    name="qaSuggestedTestType"
                    aria-label="Suggested test type"
                    required
                    placeholder="— Select —"
                    value={qaSuggestedTestType}
                    onChange={setQaSuggestedTestType}
                    options={[
                      { value: 'sanity', label: 'Sanity (quick smoke test)' },
                      { value: 'regression', label: 'Full regression' },
                      { value: 'specific', label: 'Specific module testing' },
                      { value: 'full', label: 'Full comprehensive test' },
                    ]}
                  />
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
              <SimpleSelect
                name="bdMemberId"
                aria-label="BD Member"
                placeholder="No BD assigned"
                value={bdMemberId}
                onChange={setBdMemberId}
                options={[
                  { value: '', label: 'No BD assigned' },
                  ...members
                    .filter(m => ['BD', 'Both', 'Founder'].includes(m.role || ''))
                    .map(m => ({ value: m.id, label: m.name })),
                ]}
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
