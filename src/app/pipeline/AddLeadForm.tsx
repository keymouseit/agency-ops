'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LEAD_SOURCES } from '@/lib/utils'

type Member = { id: string; name: string; role: string }

export default function AddLeadForm({ members }: { members: Member[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    })
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  const bdMembers = members.filter(m => ['BD', 'Both', 'Founder'].includes(m.role))

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ Add lead</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-semibold mb-4">New lead</h2>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="label">Client name *</label>
                <input name="clientName" required className="input" placeholder="Company or person name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Source *</label>
                  <select name="source" required className="input">
                    {LEAD_SOURCES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Owner *</label>
                  <select name="ownerId" required className="input">
                    {bdMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Budget</label>
                  <input name="budget" type="number" className="input" placeholder="0" />
                </div>
                <div>
                  <label className="label">Currency</label>
                  <select name="currency" className="input">
                    {['USD','AED','INR','GBP','EUR','AUD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea name="description" rows={2} className="input" placeholder="Brief description of what the client needs..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saving...' : 'Add lead'}
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
