'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOSS_REASONS, FAULT_AREAS, LEAD_STATUSES, formatLossReason } from '@/lib/utils'
import SimpleSelect from '@/components/SimpleSelect'

type Member = { id: string; name: string; role: string }
type Lead = { id: string; status: string; clientName: string }

const PROPOSAL_STATUSES = [
  { value: 'sent', label: 'Sent' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview', label: 'Interview' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'won', label: 'Won' },
]

export default function LeadActions({ lead, members }: { lead: Lead; members: Member[] }) {
  const [view, setView] = useState<'proposal' | 'loss' | 'status' | null>(null)
  const [loading, setLoading] = useState(false)
  const [proposalStatus, setProposalStatus] = useState('sent')
  const [writtenById, setWrittenById] = useState(members[0]?.id ?? '')
  const [leadStatus, setLeadStatus] = useState(lead.status)
  const [lossReason, setLossReason] = useState(LOSS_REASONS[0] ?? '')
  const [faultArea, setFaultArea] = useState(FAULT_AREAS[0] ?? '')
  const [faultOwnerId, setFaultOwnerId] = useState('')
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

  function openProposal() {
    setWrittenById(members[0]?.id ?? '')
    setProposalStatus('sent')
    setView('proposal')
  }

  function openLoss() {
    setLossReason(LOSS_REASONS[0] ?? '')
    setFaultArea(FAULT_AREAS[0] ?? '')
    setFaultOwnerId('')
    setView('loss')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap mt-5">
        <button type="button" className="btn-secondary text-xs" onClick={openProposal}>
          + Log proposal
        </button>
        {lead.status === 'lost' && (
          <button type="button" className="btn-secondary text-xs" onClick={openLoss}>
            + Add loss analysis
          </button>
        )}
        <button
          type="button"
          className="btn-secondary text-xs"
          onClick={() => {
            setLeadStatus(lead.status)
            setView('status')
          }}
        >
          Update status
        </button>
      </div>

      {view === 'proposal' && (
        <div className="card p-4 sm:p-5 overflow-visible">
          <h3 className="text-sm font-semibold mb-3">Log proposal</h3>
          <form onSubmit={e => submitForm(e, `/api/leads/${lead.id}/proposals`)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label">Written by</label>
                <SimpleSelect
                  name="writtenById"
                  aria-label="Written by"
                  required
                  value={writtenById}
                  onChange={setWrittenById}
                  options={members.map(m => ({ value: m.id, label: m.name }))}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Budget quoted (USD)</label>
                <input name="budgetQuoted" type="number" className="input" placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label">Tech stack</label>
                <input name="techStack" className="input" placeholder="React, Node, Postgres" />
              </div>
              <div className="min-w-0">
                <label className="label">Connects spent</label>
                <input name="connectsSpent" type="number" className="input" placeholder="0" />
              </div>
            </div>
            <div className="min-w-0">
              <label className="label">Status</label>
              <SimpleSelect
                name="status"
                aria-label="Status"
                value={proposalStatus}
                onChange={setProposalStatus}
                options={PROPOSAL_STATUSES}
              />
            </div>
            <div className="min-w-0">
              <label className="label">Interview notes</label>
              <textarea
                name="interviewNotes"
                rows={2}
                className="input !min-h-0 min-h-[2.75rem]"
                placeholder="What happened in the interview?"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Save'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'loss' && (
        <div className="card p-4 sm:p-5 border-red-100 overflow-visible">
          <h3 className="text-sm font-semibold mb-3 text-red-800">Loss analysis — required for every lost lead</h3>
          <form onSubmit={e => submitForm(e, `/api/leads/${lead.id}/loss`)} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label">Why did we lose? *</label>
                <SimpleSelect
                  name="reason"
                  aria-label="Why did we lose?"
                  required
                  value={lossReason}
                  onChange={setLossReason}
                  options={LOSS_REASONS.map(r => ({ value: r, label: formatLossReason(r) }))}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Fault area *</label>
                <SimpleSelect
                  name="faultArea"
                  aria-label="Fault area"
                  required
                  value={faultArea}
                  onChange={setFaultArea}
                  options={FAULT_AREAS.map(f => ({ value: f, label: f }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="label">Fault owner (person)</label>
                <SimpleSelect
                  name="faultOwnerId"
                  aria-label="Fault owner"
                  value={faultOwnerId}
                  onChange={setFaultOwnerId}
                  placeholder="— None / External —"
                  options={[
                    { value: '', label: '— None / External —' },
                    ...members.map(m => ({ value: m.id, label: m.name })),
                  ]}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Competitor that won</label>
                <input name="competitorWon" className="input" placeholder="Agency name or unknown" />
              </div>
            </div>
            <div className="min-w-0">
              <label className="label">What exactly happened?</label>
              <textarea
                name="notes"
                rows={2}
                className="input !min-h-0 min-h-[2.75rem]"
                placeholder="Be specific — what went wrong?"
              />
            </div>
            <div className="min-w-0">
              <label className="label">Lessons learned (action items)</label>
              <textarea
                name="lessonsLearned"
                rows={2}
                className="input !min-h-0 min-h-[2.75rem]"
                placeholder="What will we do differently next time?"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Save analysis'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'status' && (
        <div className="card p-4 overflow-visible">
          <h3 className="text-sm font-semibold mb-3">Update lead status</h3>
          <form onSubmit={e => submitForm(e, `/api/leads/${lead.id}/status`)} className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="label">New status</label>
              <SimpleSelect
                name="status"
                aria-label="Lead status"
                value={leadStatus}
                onChange={setLeadStatus}
                options={LEAD_STATUSES.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
              />
            </div>
            <div className="flex gap-2 shrink-0">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? '...' : 'Update'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setView(null)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
