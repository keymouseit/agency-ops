'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ROLE_COLORS } from '@/lib/utils'

type Member = { id: string; name: string; role: string }
type Project = { id: string; name: string; developerId: string }

const DIMS = ['delivery', 'process', 'communication', 'growth', 'culture'] as const
const DIM_LABELS: Record<string, string> = {
  delivery: 'Delivery',
  process: 'Process',
  communication: 'Communication',
  growth: 'Growth',
  culture: 'Culture',
}
const DIM_HINTS: Record<string, string> = {
  delivery: 'Did you ship what you committed to?',
  process: 'Plans, EOD, estimates, and handoffs',
  communication: 'Updates, clarity, and responsiveness',
  growth: 'Learning, improvement, and initiative',
  culture: 'Teamwork, reliability, and attitude',
}

function ScorePicker({
  value,
  onChange,
}: {
  value?: number
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-9 min-w-[2rem] flex-1 max-w-[2.5rem] text-xs rounded-lg font-medium transition-colors ${
            value === n
              ? n >= 8
                ? 'bg-green-600 text-white shadow-sm'
                : n >= 6
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-red-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function CheckInHeader({
  memberName,
  memberRole,
  step,
}: {
  memberName: string
  memberRole: string
  step: 'project' | 'self' | 'done'
}) {
  const roleCls = ROLE_COLORS[memberRole] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-blue-50/30 px-4 py-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg text-white shrink-0">
            📋
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Weekly check-in</h1>
              <span className="badge text-[10px] bg-blue-100 text-blue-800">Due Mon 10am</span>
              <span className={`badge text-[10px] ${roleCls}`}>{memberRole}</span>
            </div>
            <p className="text-sm text-gray-500">Every Monday before 10am · takes about 3 minutes</p>
            <p className="text-xs text-gray-500 mt-1">
              Submitting as <span className="font-medium text-gray-800">{memberName}</span>
            </p>
          </div>
        </div>

        {step !== 'done' && (
          <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200 self-start">
            {[
              ['project', '1. Project'],
              ['self', '2. Self-assessment'],
            ].map(([s, label]) => (
              <div
                key={s}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  step === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CheckInClient({ members, projects }: { members: Member[]; projects: Project[] }) {
  const { data: session } = useSession()
  const [step, setStep] = useState<'project' | 'self' | 'done'>('project')
  const [memberId, setMemberId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (session?.user?.id) {
      setMemberId(session.user.id)
    }
  }, [session])

  const member = members.find(m => m.id === memberId)
  const myProjects = projects.filter(p => p.developerId === memberId)
  const ratedCount = DIMS.filter(d => scores[d]).length

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
          const err = await res.json().catch(() => ({ error: 'Failed to submit project status' }))
          if (res.status === 409) {
            setLoading(false)
            router.replace('/checkin')
            router.refresh()
            return
          }
          throw new Error(err.error ?? `Failed to submit project status (${res.status})`)
        }
      }
      setLoading(false)
      setStep('self')
    } catch (err) {
      setLoading(false)
      if (err instanceof TypeError) {
        setError('Could not reach the server. Check your connection and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
      }
    }
  }

  async function submitSelf(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fd = new FormData(e.currentTarget)
      const data: Record<string, unknown> = Object.fromEntries(fd)
      DIMS.forEach(d => {
        data[d] = scores[d] ?? 5
      })
      data.memberId = memberId

      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to submit check-in' }))
        if (res.status === 409) {
          setLoading(false)
          router.replace('/checkin')
          router.refresh()
          return
        }
        throw new Error(err.error ?? `Failed to submit check-in (${res.status})`)
      }

      setLoading(false)
      setStep('done')
    } catch (err) {
      setLoading(false)
      if (err instanceof TypeError) {
        setError('Could not reach the server. Check your connection and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
      }
    }
  }

  if (step === 'done') {
    return (
      <div className="space-y-5">
        <CheckInHeader memberName={member?.name ?? ''} memberRole={member?.role ?? ''} step="done" />
        <div className="rounded-2xl border border-gray-200 bg-white p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-600 text-2xl text-white shadow-sm">
            ✓
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Check-in submitted</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Your scores and project status have been saved. See you next Monday.
          </p>
          <button type="button" onClick={() => router.push('/me')} className="btn-primary">
            Back to My Day →
          </button>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin" />
        <p className="text-sm text-gray-500">Loading your profile…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <CheckInHeader memberName={member.name} memberRole={member.role} step={step} />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0" aria-hidden>
              ⚠️
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Submission failed</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-sm shrink-0">
              ✕
            </button>
          </div>
        </div>
      )}

      {step === 'project' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
                📁
              </span>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Project status</h2>
                <p className="text-xs text-gray-500">
                  Hi {member.name.split(' ')[0]} — update your active project(s)
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {myProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">No projects assigned to you</p>
                <p className="text-xs text-gray-500 mb-4">Skip to self-assessment — you can still submit your weekly scores.</p>
                <button type="button" className="btn-primary" onClick={() => setStep('self')}>
                  Continue to self-assessment →
                </button>
              </div>
            ) : (
              <form onSubmit={submitProject} className="space-y-5">
                <div>
                  <label className="label">Select project</label>
                  <select name="projectId" className="input bg-gray-50/50 focus:bg-white">
                    {myProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Progress this week (%)</label>
                  <input
                    name="progressPct"
                    type="number"
                    min="0"
                    max="100"
                    required
                    className="input bg-gray-50/50 focus:bg-white tabular-nums"
                    placeholder="0–100"
                  />
                </div>

                <div>
                  <label className="label mb-2">On track for deadline?</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ['yes', 'Yes', 'border-green-200 text-green-700 hover:bg-green-50', 'has-[:checked]:bg-green-600 has-[:checked]:text-white has-[:checked]:border-green-600'],
                      ['at_risk', 'At risk', 'border-amber-200 text-amber-700 hover:bg-amber-50', 'has-[:checked]:bg-amber-500 has-[:checked]:text-white has-[:checked]:border-amber-500'],
                      ['no', 'No', 'border-red-200 text-red-700 hover:bg-red-50', 'has-[:checked]:bg-red-600 has-[:checked]:text-white has-[:checked]:border-red-600'],
                    ].map(([v, l, idle, active]) => (
                      <label
                        key={v}
                        className={`flex items-center justify-center p-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-colors ${idle} ${active}`}
                      >
                        <input type="radio" name="onTrack" value={v} className="sr-only" required />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Scope changes this week?</label>
                  <select name="scopeChange" className="input bg-gray-50/50 focus:bg-white">
                    <option value="none">None</option>
                    <option value="logged">Yes — logged with change order</option>
                    <option value="unlogged">Yes — NOT logged yet</option>
                  </select>
                </div>

                <div>
                  <label className="label mb-2">Client updated this week?</label>
                  <div className="flex gap-2">
                    {[
                      ['true', 'Yes'],
                      ['false', 'No'],
                    ].map(([v, l]) => (
                      <label
                        key={v}
                        className="flex-1 flex items-center justify-center p-2.5 rounded-lg border cursor-pointer text-sm font-medium border-gray-200 has-[:checked]:bg-gray-900 has-[:checked]:text-white has-[:checked]:border-gray-900 transition-colors"
                      >
                        <input type="radio" name="clientUpdated" value={v} className="sr-only" required />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Blockers (optional)</label>
                  <input
                    name="blockers"
                    className="input bg-gray-50/50 focus:bg-white"
                    placeholder="What's slowing you down?"
                  />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
                  {loading ? 'Saving…' : 'Save & continue →'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {step === 'self' && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
                  ⭐
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Self-assessment</h2>
                  <p className="text-xs text-gray-500">1 = very poor · 10 = excellent</p>
                </div>
              </div>
              <span className="badge bg-gray-100 text-gray-600 text-[11px]">{ratedCount}/5 rated</span>
            </div>
          </div>

          <form onSubmit={submitSelf} className="p-5 space-y-5">
            {DIMS.map(d => (
              <div key={d} className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                <div className="mb-2">
                  <label className="text-sm font-semibold text-gray-900">{DIM_LABELS[d]}</label>
                  <p className="text-xs text-gray-500 mt-0.5">{DIM_HINTS[d]}</p>
                </div>
                <ScorePicker value={scores[d]} onChange={n => setScores(prev => ({ ...prev, [d]: n }))} />
              </div>
            ))}

            <div>
              <label className="label">One thing you could have done better</label>
              <textarea
                name="selfNotes"
                rows={3}
                className="input min-h-[88px] bg-gray-50/50 focus:bg-white"
                placeholder="Be specific — what and how."
              />
            </div>

            <div>
              <label className="label mb-2">Repeated a mistake from last week?</label>
              <div className="flex gap-2">
                {[
                  ['false', 'No', 'has-[:checked]:bg-green-100 has-[:checked]:text-green-800 has-[:checked]:border-green-300'],
                  ['true', 'Yes', 'has-[:checked]:bg-red-100 has-[:checked]:text-red-800 has-[:checked]:border-red-300'],
                ].map(([v, l, active]) => (
                  <label
                    key={v}
                    className={`flex-1 flex items-center justify-center p-2.5 rounded-lg border cursor-pointer text-sm font-medium border-gray-200 transition-colors ${active}`}
                  >
                    <input type="radio" name="repeatedMistake" value={v} className="sr-only" required />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || DIMS.some(d => !scores[d])}
              className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Submitting…'
                : DIMS.some(d => !scores[d])
                  ? `Rate all 5 dimensions (${ratedCount}/5)`
                  : 'Submit check-in ✓'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
