'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; name: string }
type WonLead = { id: string; clientName: string }

export default function AddProjectForm({ members, wonLeads }: { members: Member[]; wonLeads: WonLead[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ New project</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">New project</h2>
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
                  <label className="label">Project owner *</label>
                  <select name="ownerId" required className="input">
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Client name</label>
                  <input name="clientName" className="input" placeholder="Client company" />
                </div>
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
                  <label className="label">Estimated hours *</label>
                  <input name="estimatedHours" type="number" required className="input" placeholder="e.g. 280" />
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
                  <label className="label">Estimated end date *</label>
                  <input name="estimatedEnd" type="date" required className="input" />
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
