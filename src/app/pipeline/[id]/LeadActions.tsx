'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOSS_REASONS, FAULT_AREAS, LEAD_STATUSES } from '@/lib/utils'

type Member = { id: string; name: string; role: string }
type Lead = { id: string; status: string; clientName: string }

export default function LeadActions({ lead, members }: { lead: Lead; members: Member[] }) {
  const [view, setView] = useState<'proposal'|'loss'|'status'|null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function post(url: string, data: Record<string, unknown>) {
    setLoading(true)
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setLoading(false)
    setView(null)
    router.refresh()
  }

  async function submitForm(e: React.FormEvent<HTMLFormElement>, url: string) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await post(url, Object.fromEntries(fd))
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <button className="btn-secondary text-xs" onClick={() => setView('proposal')}>+ Log proposal</button>
        {lead.status === 'lost' && <button className="btn-secondary text-xs" onClick={() => setView('loss')}>+ Add loss analysis</button>}
        <button className="btn-secondary text-xs" onClick={() => setView('status')}>Update status</button>
      </div>

      {view === 'proposal' && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Log proposal</h3>
          <form onSubmit={e => submitForm(e, `/api/leads/${lead.id}/proposals`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Written by</label>
                <select name="writtenById" required className="input">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Budget quoted (USD)</label>
                <input name="budgetQuoted" type="number" className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tech stack</label>
                <input name="techStack" className="input" placeholder="React, Node.js, PostgreSQL" />
              </div>
              <div>
                <label className="label">Connects spent (Upwork)</label>
                <input name="connectsSpent" type="number" className="input" />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select name="status" className="input">
                {['sent','shortlisted','interview','rejected','won'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Interview notes</label>
              <textarea name="interviewNotes" rows={2} className="input" placeholder="What happened in the interview?" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Save'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'loss' && (
        <div className="card p-5 border-red-100">
          <h3 className="text-sm font-semibold mb-3 text-red-800">Loss analysis — required for every lost lead</h3>
          <form onSubmit={e => submitForm(e, `/api/leads/${lead.id}/loss`)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Why did we lose? *</label>
                <select name="reason" required className="input">
                  {LOSS_REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fault area *</label>
                <select name="faultArea" required className="input">
                  {FAULT_AREAS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fault owner (person)</label>
                <select name="faultOwnerId" className="input">
                  <option value="">— None / External —</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Competitor that won</label>
                <input name="competitorWon" className="input" placeholder="Agency name or 'unknown'" />
              </div>
            </div>
            <div>
              <label className="label">What exactly happened?</label>
              <textarea name="notes" rows={2} className="input" placeholder="Be specific — what went wrong?" />
            </div>
            <div>
              <label className="label">Lessons learned (action items)</label>
              <textarea name="lessonsLearned" rows={2} className="input" placeholder="What will we do differently next time?" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Save analysis'}</button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {view === 'status' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Update lead status</h3>
          <form onSubmit={e => submitForm(e, `/api/leads/${lead.id}/status`)} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="label">New status</label>
              <select name="status" defaultValue={lead.status} className="input">
                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Update'}</button>
            <button type="button" className="btn-secondary" onClick={() => setView(null)}>Cancel</button>
          </form>
        </div>
      )}
    </div>
  )
}
