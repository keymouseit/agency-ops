'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LEAD_SOURCES, MOM_MEETING_TYPES, ROLE_COLORS } from '@/lib/utils'
import { momClientKey } from '@/lib/mom'

type Member = { id: string; name: string; role: string }
type CustomAttendee = { name: string; role: string }
type ExistingClient = {
  key: string
  clientName: string
  companyName: string | null
  meetingCount: number
  threadHref: string
}

const CUSTOM_ATTENDEE_ROLES = ['Guest', 'Client', 'External'] as const

function AttendeePicker({
  members,
  memberIds,
  onMemberIdsChange,
  customAttendees,
  onCustomAttendeesChange,
}: {
  members: Member[]
  memberIds: string[]
  onMemberIdsChange: (ids: string[]) => void
  customAttendees: CustomAttendee[]
  onCustomAttendeesChange: (attendees: CustomAttendee[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customRole, setCustomRole] = useState<string>('Guest')

  const selectedMembers = members.filter(m => memberIds.includes(m.id))

  function toggleMember(id: string) {
    onMemberIdsChange(memberIds.includes(id) ? memberIds.filter(x => x !== id) : [...memberIds, id])
  }

  function removeMember(id: string) {
    onMemberIdsChange(memberIds.filter(x => x !== id))
  }

  function addCustom() {
    const name = customName.trim()
    if (!name) return
    const exists = customAttendees.some(a => a.name.toLowerCase() === name.toLowerCase())
    if (exists) return
    onCustomAttendeesChange([...customAttendees, { name, role: customRole }])
    setCustomName('')
  }

  function removeCustom(index: number) {
    onCustomAttendeesChange(customAttendees.filter((_, i) => i !== index))
  }

  const hasSelection = selectedMembers.length > 0 || customAttendees.length > 0

  return (
    <div className="space-y-3">
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="input w-full min-h-[42px] text-left flex flex-wrap gap-1.5 items-center justify-between"
        >
          <span className="flex flex-wrap gap-1.5 flex-1">
            {!hasSelection ? (
              <span className="text-gray-400 text-sm">Select team members...</span>
            ) : (
              <>
                {selectedMembers.map(m => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-gray-100 text-xs"
                  >
                    <span className="text-gray-800">{m.name}</span>
                    <span className={`badge text-xs ${ROLE_COLORS[m.role] ?? 'bg-gray-200 text-gray-600'}`}>
                      {m.role}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); removeMember(m.id) }}
                      onKeyDown={e => { if (e.key === 'Enter') removeMember(m.id) }}
                      className="ml-0.5 text-gray-400 hover:text-gray-700 leading-none px-0.5"
                    >
                      ×
                    </span>
                  </span>
                ))}
                {customAttendees.map((a, i) => (
                  <span
                    key={`${a.name}-${i}`}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-slate-100 text-xs"
                  >
                    <span className="text-gray-800">{a.name}</span>
                    <span className="badge text-xs bg-slate-200 text-slate-700">{a.role}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); removeCustom(i) }}
                      onKeyDown={e => { if (e.key === 'Enter') removeCustom(i) }}
                      className="ml-0.5 text-gray-400 hover:text-gray-700 leading-none px-0.5"
                    >
                      ×
                    </span>
                  </span>
                ))}
              </>
            )}
          </span>
          <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
              {members.map(m => {
                const checked = memberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-gray-50 ${checked ? 'bg-blue-50' : ''}`}
                  >
                    <span className={`w-4 text-center ${checked ? 'text-blue-600 font-bold' : 'text-transparent'}`}>✓</span>
                    <span className="flex-1 text-gray-900">{m.name}</span>
                    <span className={`badge text-xs ${ROLE_COLORS[m.role] ?? 'bg-gray-100 text-gray-600'}`}>
                      {m.role}
                    </span>
                  </button>
                )
              })}
              {members.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-400 text-center">No team members found</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
        <p className="text-xs font-medium text-gray-600 mb-2">Add someone not in the list</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            className="input flex-1"
            placeholder="Name (e.g. client contact)"
          />
          <select
            value={customRole}
            onChange={e => setCustomRole(e.target.value)}
            className="input sm:w-36"
          >
            {CUSTOM_ATTENDEE_ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addCustom}
            disabled={!customName.trim()}
            className="btn-secondary shrink-0"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Team members selected above will receive an in-app notification.
        </p>
      </div>
    </div>
  )
}

export default function MomForm({
  members,
  existingClients = [],
}: {
  members: Member[]
  existingClients?: ExistingClient[]
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [customAttendees, setCustomAttendees] = useState<CustomAttendee[]>([])
  const [clientName, setClientName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const router = useRouter()

  const matchedClient = useMemo(() => {
    if (!clientName.trim()) return null
    const key = momClientKey(clientName, companyName)
    return existingClients.find(c => c.key === key) ?? null
  }, [clientName, companyName, existingClients])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData(e.currentTarget)
    attendeeIds.forEach(id => fd.append('attendeeIds', id))
    if (customAttendees.length) {
      fd.set('customAttendees', JSON.stringify(customAttendees))
    }

    const res = await fetch('/api/mom', { method: 'POST', body: fd })
    setLoading(false)

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to save MOM. Please try again.')
      return
    }

    const data = await res.json()
    router.push(`/mom/${data.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Meeting details</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Date *</label>
            <input name="meetingDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label">Time</label>
            <input name="meetingTime" type="time" className="input" />
          </div>
          <div>
            <label className="label">Meeting type *</label>
            <select name="meetingType" required className="input">
              <option value="">Select type</option>
              {MOM_MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Lead source</label>
            <select name="leadSource" className="input">
              <option value="">Select source</option>
              {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Domain / industry</label>
          <input name="domain" className="input" placeholder="e.g. Healthcare, FinTech, E-commerce" />
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Client & company</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Client name *</label>
            <input
              name="clientName"
              required
              className="input"
              placeholder="Contact person"
              value={clientName}
              onChange={e => setClientName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Client LinkedIn profile</label>
            <input name="clientLinkedIn" type="url" className="input" placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <label className="label">Company name</label>
            <input
              name="companyName"
              className="input"
              placeholder="Company"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Company LinkedIn profile</label>
            <input name="companyLinkedIn" type="url" className="input" placeholder="https://linkedin.com/company/..." />
          </div>
          <div>
            <label className="label">Client email</label>
            <input name="clientEmail" type="email" className="input" placeholder="client@company.com" />
          </div>
          <div>
            <label className="label">Client phone number</label>
            <input name="clientPhone" type="tel" className="input" placeholder="+1 555 000 0000" />
          </div>
        </div>

        {matchedClient && (
          <div className="px-3 py-2.5 rounded-lg bg-violet-50 border border-violet-100 text-sm text-violet-900">
            This client already has {matchedClient.meetingCount} meeting
            {matchedClient.meetingCount === 1 ? '' : 's'} logged.{' '}
            <Link href={matchedClient.threadHref} className="font-medium underline hover:text-violet-700">
              View thread
            </Link>
            {' '}— your new entry will be added to the same timeline.
          </div>
        )}
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Discussion notes</h2>
        <div>
          <label className="label">Meeting outcome</label>
          <textarea name="meetingOutcome" rows={5} className="input min-h-[120px]" placeholder="What was decided or concluded?" />
        </div>
        <div>
          <label className="label">Client pain points</label>
          <textarea name="clientPainPoints" rows={5} className="input min-h-[120px]" placeholder="Problems or challenges the client shared" />
        </div>
        <div>
          <label className="label">Our approach</label>
          <textarea name="ourApproach" rows={5} className="input min-h-[120px]" placeholder="How we positioned our solution" />
        </div>
        <div>
          <label className="label">Requirement from client</label>
          <textarea name="requirementsFromClient" rows={5} className="input min-h-[120px]" placeholder="Scope, features, or deliverables discussed" />
        </div>
        <div>
          <label className="label">Next action item</label>
          <textarea name="nextActionItem" rows={4} className="input min-h-[100px]" placeholder="Who does what, and by when?" />
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Attendees</h2>
        <AttendeePicker
          members={members}
          memberIds={attendeeIds}
          onMemberIdsChange={setAttendeeIds}
          customAttendees={customAttendees}
          onCustomAttendeesChange={setCustomAttendees}
        />
      </section>

      <section className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Follow-up & recording</h2>
        <div>
          <label className="label">Follow-up date</label>
          <input name="followUpDate" type="date" className="input max-w-xs" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Upload meeting video</label>
            <input
              name="meetingVideo"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mkv"
              className="input py-1.5"
            />
            <p className="text-xs text-gray-400 mt-1">MP4, WebM, MOV — max 200 MB</p>
          </div>
          <div>
            <label className="label">Or paste video link</label>
            <input
              name="meetingVideoUrl"
              type="url"
              className="input"
              placeholder="https://drive.google.com/... or Loom link"
            />
            <p className="text-xs text-gray-400 mt-1">Google Drive, Loom, YouTube, etc.</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pb-8">
        <button type="submit" disabled={loading} className="btn-primary px-8">
          {loading ? 'Saving...' : 'Save MOM'}
        </button>
        <Link href="/mom" className="btn-secondary">Cancel</Link>
      </div>
    </form>
  )
}
