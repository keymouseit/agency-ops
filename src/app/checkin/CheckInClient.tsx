'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type Member = { id: string; name: string; role: string }
type Project = { id: string; name: string; ownerId: string }

const DIMS = ['delivery', 'process', 'communication', 'growth', 'culture'] as const
const DIM_LABELS: Record<string, string> = {
  delivery: 'Delivery', process: 'Process', communication: 'Communication', growth: 'Growth', culture: 'Culture',
}

export default function CheckInClient({ members, projects }: { members: Member[]; projects: Project[] }) {
  const { data: session } = useSession()
  const [step, setStep] = useState<'project'|'self'|'done'>('project')
  const [memberId, setMemberId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  // Auto-set memberId from session
  useEffect(() => {
    if (session?.user?.id) {
      setMemberId(session.user.id)
    }
  }, [session])

  const member = members.find(m => m.id === memberId)
  const myProjects = projects.filter(p => p.ownerId === memberId)

  async function submitProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fd = new FormData(e.currentTarget)
      const projectId = fd.get('projectId') as string
      if (projectId) {
        const res = await fetch(`/api/projects/${projectId}/checkin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...Object.fromEntries(fd), submittedById: memberId }),
        })

        if (!res.ok) {
          throw new Error('Failed to submit project status')
        }
      }
      setLoading(false)
      setStep('self')
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    }
  }

  async function submitSelf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fd = new FormData(e.currentTarget)
      const data: Record<string, unknown> = Object.fromEntries(fd)
      DIMS.forEach(d => { data[d] = scores[d] ?? 5 })
      data.memberId = memberId

      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        throw new Error('Failed to submit check-in')
      }

      setLoading(false)
      setStep('done')
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
    }
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-4xl mb-4">✓</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Check-in submitted</h1>
        <p className="text-gray-500 mb-6">Your scores and project status have been saved. See you next Monday.</p>
        <div className="flex gap-3 justify-center">
          <a href="/" className="btn-primary">Back to dashboard</a>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-gray-400 mb-4">Loading your profile...</div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Weekly check-in</h1>
      <p className="text-sm text-gray-500 mb-2">Every Monday before 10am. Takes 3 minutes.</p>
      <p className="text-xs text-gray-400 mb-8">Submitting as: <strong>{member.name}</strong></p>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl text-red-600">⚠</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Submission failed</h3>
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-2">Please check your connection and try again.</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="flex gap-2 mb-8">
        {[['project', 'Project status'], ['self', 'Self-assessment']].map(([s, label]) => (
          <div key={s} className={`flex-1 text-center py-1.5 rounded-lg text-xs font-medium ${step === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
            {label}
          </div>
        ))}
      </div>

      {step === 'project' && member && (
        <div className="card p-6">
          <h2 className="text-base font-semibold mb-1">Project status</h2>
          <p className="text-xs text-gray-400 mb-4">Hi {member.name.split(' ')[0]}. Update your active project(s).</p>
          {myProjects.length === 0 ? (
            <div>
              <p className="text-sm text-gray-400 mb-4">No projects assigned to you this week.</p>
              <button className="btn-primary" onClick={() => setStep('self')}>Continue to self-assessment →</button>
            </div>
          ) : (
            <form onSubmit={submitProject} className="space-y-4">
              <div>
                <label className="label">Select project</label>
                <select name="projectId" className="input">
                  {myProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Progress this week (%)</label>
                <input name="progressPct" type="number" min="0" max="100" required className="input" placeholder="0–100" />
              </div>
              <div>
                <label className="label">Are we on track for the deadline?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[['yes', 'Yes ✓', 'green'], ['at_risk', 'At risk ⚠', 'amber'], ['no', 'No ✗', 'red']].map(([v, l, c]) => (
                    <label key={v} className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors
                      ${c === 'green' ? 'has-[:checked]:bg-green-100 has-[:checked]:border-green-400 has-[:checked]:text-green-800' :
                        c === 'amber' ? 'has-[:checked]:bg-amber-100 has-[:checked]:border-amber-400 has-[:checked]:text-amber-800' :
                        'has-[:checked]:bg-red-100 has-[:checked]:border-red-400 has-[:checked]:text-red-800'} border-gray-200`}>
                      <input type="radio" name="onTrack" value={v} className="sr-only" />{l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Any scope changes this week?</label>
                <select name="scopeChange" className="input">
                  <option value="none">None</option>
                  <option value="logged">Yes — logged with change order</option>
                  <option value="unlogged">Yes — NOT logged yet ⚠</option>
                </select>
              </div>
              <div>
                <label className="label">Client updated this week?</label>
                <div className="flex gap-2">
                  {[['true', 'Yes'], ['false', 'No']].map(([v, l]) => (
                    <label key={v} className="flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg border cursor-pointer text-sm font-medium border-gray-200 has-[:checked]:bg-gray-900 has-[:checked]:text-white has-[:checked]:border-gray-900">
                      <input type="radio" name="clientUpdated" value={v} className="sr-only" />{l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Any blockers? (what's slowing you down)</label>
                <input name="blockers" className="input" placeholder="Or leave empty if none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="btn-primary flex-1">
                  {loading ? 'Saving...' : 'Save & continue →'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {step === 'self' && member && (
        <div className="card p-6">
          <h2 className="text-base font-semibold mb-1">Self-assessment</h2>
          <p className="text-xs text-gray-400 mb-4">Score yourself honestly. 1 = very poor, 10 = excellent.</p>
          <form onSubmit={submitSelf} className="space-y-4">
            {DIMS.map(d => (
              <div key={d}>
                <label className="label">{DIM_LABELS[d]}</label>
                <div className="flex gap-1">
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScores(prev => ({ ...prev, [d]: n }))}
                      className={`flex-1 py-2 text-xs rounded-md transition-colors font-medium ${
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
              <label className="label">One thing you could have done better this week</label>
              <textarea name="selfNotes" rows={2} className="input" placeholder="Be specific — what and how." />
            </div>
            <div>
              <label className="label">Did you repeat a mistake from last week?</label>
              <div className="flex gap-2">
                {[['false', 'No'], ['true', 'Yes']].map(([v, l]) => (
                  <label key={v} className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-lg border cursor-pointer text-sm font-medium border-gray-200 ${v === 'true' ? 'has-[:checked]:bg-red-100 has-[:checked]:text-red-800 has-[:checked]:border-red-300' : 'has-[:checked]:bg-green-100 has-[:checked]:text-green-800 has-[:checked]:border-green-300'}`}>
                    <input type="radio" name="repeatedMistake" value={v} className="sr-only" />{l}
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || DIMS.some(d => !scores[d])}
              className="btn-primary w-full"
            >
              {loading ? 'Submitting...' : DIMS.some(d => !scores[d]) ? 'Rate all 5 dimensions first' : 'Submit check-in ✓'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
