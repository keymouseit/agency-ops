'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; name: string; role: string }
const DIMS = ['delivery', 'process', 'communication', 'growth', 'culture'] as const
const DIM_LABELS: Record<string, string> = {
  delivery: 'Delivery (did you hit your commitments?)',
  process: 'Process (did you follow every rule?)',
  communication: 'Communication (daily updates, blockers raised fast?)',
  growth: 'Growth (no repeated mistakes, feedback applied?)',
  culture: 'Culture (ownership, no ego, supported teammates?)',
}

export default function SubmitScoreForm({
  members,
  founderMode = false,
}: {
  members: Member[]
  founderMode?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const router = useRouter()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const data: Record<string, unknown> = Object.fromEntries(fd)
    DIMS.forEach(d => { data[d] = scores[d] ?? 5 })
    if (founderMode) data.founderScore = true

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to submit scores' }))
        setError(err.error ?? `Failed to submit scores (${res.status})`)
        setLoading(false)
        return
      }
      setLoading(false)
      setOpen(false)
      setScores({})
      router.refresh()
    } catch {
      setError('Network error — could not submit scores.')
      setLoading(false)
    }
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>+ Submit this week's score</button>
      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-1">
              {founderMode ? 'Submit team member score' : 'Weekly self-assessment'}
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              {founderMode
                ? 'Founder score for this week. Shown on the team scorecard table.'
                : 'Be honest. Scores you give yourself will be compared with the founder\'s view in 1-on-1s.'}
            </p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">{founderMode ? 'Team member *' : 'Your name *'}</label>
                <select name="memberId" required className="input">
                  <option value="">Select...</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              {DIMS.map(d => (
                <div key={d}>
                  <label className="label">{DIM_LABELS[d]}</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScores(prev => ({ ...prev, [d]: n }))}
                        className={`flex-1 py-1.5 text-xs rounded transition-colors ${
                          scores[d] === n
                            ? n >= 8 ? 'bg-green-600 text-white' : n >= 6 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <label className="label">{founderMode ? 'Notes (optional)' : 'One thing you could have done better'}</label>
                <textarea name="selfNotes" rows={2} className="input" placeholder={founderMode ? 'Context for 1-on-1...' : 'Be specific...'} />
              </div>
              {founderMode && (
                <div>
                  <label className="label">Did you repeat a mistake from last week?</label>
                  <select name="repeatedMistake" className="input">
                    <option value="false">No</option>
                    <option value="true">Yes — I'm working on it</option>
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading || DIMS.some(d => !scores[d])} className="btn-primary flex-1">
                  {loading ? 'Submitting...' : DIMS.some(d => !scores[d]) ? 'Rate all 5 dimensions' : 'Submit scores'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setScores({}) }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
