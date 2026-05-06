'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = { id: string; name: string; role: string }
type Goal = {
  id: string; memberId: string; title: string; description: string | null
  category: string; quarter: string; progressPct: number; status: string
  successMetric: string | null; targetDate: string | null
  member: { name: string; role: string }
}

const CATEGORIES = ['delivery','process','communication','growth','culture','business']
const QUARTERS = ['Q1-2025','Q2-2025','Q3-2025','Q4-2025','Q1-2026','Q2-2026','Q3-2026','Q4-2026']
const CAT_COLORS: Record<string,string> = {
  delivery:'bg-blue-100 text-blue-800', process:'bg-purple-100 text-purple-800',
  communication:'bg-teal-100 text-teal-800', growth:'bg-amber-100 text-amber-800',
  culture:'bg-green-100 text-green-800', business:'bg-red-100 text-red-800',
}

export default function GoalsClient({ members, goals }: { members: Member[]; goals: Goal[] }) {
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filterMember, setFilterMember] = useState('')
  const [filterQuarter, setFilterQuarter] = useState('')
  const router = useRouter()

  async function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(fd)),
    })
    setLoading(false)
    setShowNew(false)
    router.refresh()
  }

  async function updateProgress(goalId: string, progressPct: number) {
    await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressPct }),
    })
    router.refresh()
  }

  async function updateStatus(goalId: string, status: string) {
    await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    router.refresh()
  }

  const filtered = goals.filter(g =>
    (!filterMember || g.memberId === filterMember) &&
    (!filterQuarter || g.quarter === filterQuarter)
  )

  const byMember = members.map(m => ({
    member: m,
    goals: filtered.filter(g => g.memberId === m.id),
  })).filter(g => g.goals.length > 0 || !filterMember)

  const quarters = [...new Set(goals.map(g => g.quarter))].sort().reverse()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Goals & KRAs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Quarterly goals per team member. Set by founder. Progress updated weekly.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ Set goal</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select className="input w-auto" value={filterMember} onChange={e => setFilterMember(e.target.value)}>
          <option value="">All members</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select className="input w-auto" value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)}>
          <option value="">All quarters</option>
          {quarters.map(q => <option key={q}>{q}</option>)}
        </select>
      </div>

      {/* New goal form */}
      {showNew && (
        <div className="card p-6 mb-6 bg-blue-50 border-blue-100">
          <h2 className="text-sm font-semibold text-blue-900 mb-4">Set a new goal</h2>
          <form onSubmit={createGoal} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Team member *</label>
                <select name="memberId" required className="input">
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Category *</label>
                <select name="category" required className="input">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Quarter *</label>
                <select name="quarter" required className="input">
                  {QUARTERS.map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Goal title *</label>
              <input name="title" required className="input" placeholder="e.g. Zero client-reported bugs for 4 consecutive weeks" />
            </div>
            <div>
              <label className="label">What does success look like? (measurable)</label>
              <input name="successMetric" className="input" placeholder="e.g. 4 weeks in a row with no client-reported bug" />
            </div>
            <div>
              <label className="label">Context / why this matters</label>
              <textarea name="description" rows={2} className="input" />
            </div>
            <div>
              <label className="label">Target date</label>
              <input name="targetDate" type="date" className="input" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={loading} className="btn-primary">{loading ? '...' : 'Set goal'}</button>
              <button type="button" className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Goals by member */}
      {byMember.map(({ member: m, goals: mg }) => (
        <div key={m.id} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-800">{m.name}</span>
            <span className="text-xs text-gray-400">{m.role}</span>
            <span className="text-xs text-gray-400">· {mg.length} goal{mg.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-3">
            {mg.map(g => (
              <div key={g.id} className={`card p-4 ${g.status === 'achieved' ? 'bg-green-50 border-green-100' : g.status === 'missed' ? 'bg-red-50 border-red-100' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{g.title}</span>
                      <span className={`badge text-xs ${CAT_COLORS[g.category] ?? 'bg-gray-100 text-gray-600'}`}>{g.category}</span>
                      <span className="text-xs text-gray-400">{g.quarter}</span>
                      {g.status === 'achieved' && <span className="badge bg-green-100 text-green-800 text-xs">✓ Achieved</span>}
                      {g.status === 'missed' && <span className="badge bg-red-100 text-red-800 text-xs">✗ Missed</span>}
                    </div>
                    {g.successMetric && (
                      <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2">
                        ✓ Done when: {g.successMetric}
                      </p>
                    )}
                    {g.description && <p className="text-xs text-gray-500 mb-2">{g.description}</p>}

                    {/* Progress bar + slider */}
                    {g.status === 'active' && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${g.progressPct >= 80 ? 'bg-green-500' : g.progressPct >= 50 ? 'bg-amber-400' : 'bg-gray-300'}`}
                            style={{ width: `${g.progressPct}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-700 w-10">{g.progressPct}%</span>
                        <input
                          type="range" min="0" max="100" step="5"
                          defaultValue={g.progressPct}
                          onChange={e => updateProgress(g.id, parseInt(e.target.value))}
                          className="w-24"
                        />
                      </div>
                    )}
                  </div>

                  {g.status === 'active' && (
                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => updateStatus(g.id, 'achieved')}
                        className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                      >Mark achieved</button>
                      <button
                        onClick={() => updateStatus(g.id, 'missed')}
                        className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >Mark missed</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {mg.length === 0 && (
              <div className="card p-4 text-sm text-gray-400 text-center">
                No goals set for {m.name} yet.
                <button className="ml-2 text-blue-600 hover:underline" onClick={() => setShowNew(true)}>Set one →</button>
              </div>
            )}
          </div>
        </div>
      ))}

      {goals.length === 0 && (
        <div className="card p-12 text-center text-gray-400 text-sm">
          No goals set yet. Goals are the "what good looks like" target that weekly scores measure progress toward.
        </div>
      )}
    </div>
  )
}
