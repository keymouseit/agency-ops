'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { softRefresh } from '@/lib/soft-refresh'
import AssigneeMultiSelect from './AssigneeMultiSelect'

type Member = { id: string; name: string; role: string }
type WonLead = { id: string; clientName: string }

export default function AddProjectForm({
  members,
  wonLeads,
  currentUserId,
  currentUserRole
}: {
  members: Member[]
  wonLeads: WonLead[]
  currentUserId?: string
  currentUserRole?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Check if current user is BD or Both (should be auto-assigned as client manager)
  const isBDRole = ['BD', 'Both'].includes(currentUserRole || '')
  const canChangeBD = ['Founder', 'Manager'].includes(currentUserRole || '')

  // Get current user's name for display
  const currentUserName = members.find(m => m.id === currentUserId)?.name

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const fd = new FormData(e.currentTarget)
      const developerIds = fd.getAll('developerIds').filter((id): id is string => typeof id === 'string')
      if (!developerIds.length) {
        setError('Select at least one assigned person.')
        setLoading(false)
        return
      }
      const data = Object.fromEntries(fd)
      const payload = { ...data, developerIds, developerId: developerIds[0] }

      // Validate estimated hours only when provided
      const estimatedHoursRaw = (data.estimatedHours as string)?.trim()
      if (estimatedHoursRaw) {
        const estimatedHours = parseFloat(estimatedHoursRaw)
        if (Number.isNaN(estimatedHours) || estimatedHours <= 0) {
          setError('Estimated hours must be greater than 0 when provided')
          setLoading(false)
          return
        }
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to create project' }))
        throw new Error(errData.error || 'Failed to create project')
      }

      setLoading(false)
      setOpen(false)
      softRefresh(router)
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to create project. Please try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-full border border-green-700 px-4 py-1.5 text-sm font-medium text-green-800 hover:bg-green-50"
        onClick={() => setOpen(true)}
      >
        New project
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New project</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2 text-red-800">
                  <span className="text-lg">⚠</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">Failed to create project</div>
                    <div className="text-xs text-red-700 mt-0.5">{error}</div>
                  </div>
                  <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
                </div>
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Project name *</label>
                <input name="name" required className="input" placeholder="e.g. HealthSync Patient Portal" />
              </div>
              {wonLeads.length > 0 && (
                <div>
                  <label className="label">Link to won lead (optional)</label>
                  <select name="leadId" className="input">
                    <option value="">— Not linked —</option>
                    {wonLeads.map(l => <option key={l.id} value={l.id}>{l.clientName}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Assigned people *</label>
                  <AssigneeMultiSelect
                    members={members}
                    selectedIds={currentUserId ? [currentUserId] : []}
                  />
                </div>
                <div>
                  <label className="label">BD (client manager)</label>
                  {isBDRole ? (
                    <>
                      <input type="hidden" name="bdMemberId" value={currentUserId || ''} />
                      <div className="input bg-gray-50 text-gray-500 cursor-not-allowed">
                        {currentUserName} (you)
                      </div>
                    </>
                  ) : (
                    <select name="bdMemberId" className="input">
                      <option value="">No BD assigned</option>
                      {members.filter(m => ['BD', 'Both', 'Founder'].includes(m.role)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Client name</label>
                <input name="clientName" className="input" placeholder="Client company" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Contract value</label>
                  <input name="contractValue" type="number" className="input" placeholder="0" />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select name="currency" className="input">
                    {['USD','AED','INR','GBP','EUR','AUD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Estimated hours</label>
                  <input name="estimatedHours" type="number" min="0" step="1" className="input" placeholder="Optional — e.g. 280" />
                </div>
                <div>
                  <label className="label">Tech stack</label>
                  <input name="techStack" className="input" placeholder="React, Node.js, ..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Start date</label>
                  <input name="startDate" type="date" className="input" />
                </div>
                <div>
                  <label className="label">Estimated end date</label>
                  <input name="estimatedEnd" type="date" className="input" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Creating...' : 'Create project'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
