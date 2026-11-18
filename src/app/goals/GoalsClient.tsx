'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MemberNameLink from '@/components/MemberNameLink'
import SimpleSelect from '@/components/SimpleSelect'

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

export default function GoalsClient({
  members,
  goals,
  canLinkMembers = false,
}: {
  members: Member[]
  goals: Goal[]
  /** Viewer can open /settings/team/[id] — member names link there. */
  canLinkMembers?: boolean
}) {
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterMember, setFilterMember] = useState('')
  const [filterQuarter, setFilterQuarter] = useState('')
  const [newMemberId, setNewMemberId] = useState(members[0]?.id ?? '')
  const [newCategory, setNewCategory] = useState(CATEGORIES[0])
  const [newQuarter, setNewQuarter] = useState(QUARTERS[QUARTERS.length - 1] ?? 'Q4-2026')
  const router = useRouter()

  async function createGoal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fd = new FormData(e.currentTarget)
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(fd)),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to create goal' }))
        throw new Error(errData.error || 'Failed to create goal')
      }

      setLoading(false)
      setShowNew(false)
      router.refresh()
    } catch (err) {
      setLoading(false)
      setError(err instanceof Error ? err.message : 'Failed to create goal. Please try again.')
    }
  }

  async function updateProgress(goalId: string, progressPct: number) {
    await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressPct }),
    })
    router.refresh()
  }

  async function updateStatus(goalId: string, status: 'achieved' | 'missed') {
    const res = await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(status === 'achieved' ? { progressPct: 100 } : {}),
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update goal' }))
      throw new Error(err.error ?? 'Failed to update goal')
    }
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

  function openNewFor(memberId?: string) {
    if (memberId) setNewMemberId(memberId)
    setShowNew(true)
  }

  return (
    <div className="min-w-0 w-full max-w-full pb-8">
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900">Goals &amp; KRAs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Quarterly goals per team member. Set by founder. Progress updated weekly.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary inline-flex items-center justify-center self-start shrink-0 text-sm !px-3 !py-2 whitespace-nowrap"
          onClick={() => openNewFor()}
        >
          + Set goal
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5 max-w-xl">
        <SimpleSelect
          aria-label="Filter by member"
          value={filterMember}
          onChange={setFilterMember}
          options={[
            { value: '', label: 'All members' },
            ...members.map(m => ({ value: m.id, label: m.name })),
          ]}
        />
        <SimpleSelect
          aria-label="Filter by quarter"
          value={filterQuarter}
          onChange={setFilterQuarter}
          options={[
            { value: '', label: 'All quarters' },
            ...quarters.map(q => ({ value: q, label: q })),
          ]}
        />
      </div>

      {/* New goal form */}
      {showNew && (
        <div className="card p-4 sm:p-6 mb-6 bg-blue-50/80 border-blue-100">
          <h2 className="text-sm font-semibold text-blue-900 mb-4">Set a new goal</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2 text-red-800">
                <span className="text-lg">⚠</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Failed to create goal</div>
                  <div className="text-xs text-red-700 mt-0.5 break-words">{error}</div>
                </div>
                <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600 shrink-0">
                  ✕
                </button>
              </div>
            </div>
          )}

          <form onSubmit={createGoal} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="min-w-0">
                <label className="label">Team member *</label>
                <SimpleSelect
                  aria-label="Team member"
                  name="memberId"
                  required
                  value={newMemberId}
                  onChange={setNewMemberId}
                  options={members.map(m => ({ value: m.id, label: m.name }))}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Category *</label>
                <SimpleSelect
                  aria-label="Category"
                  name="category"
                  required
                  value={newCategory}
                  onChange={setNewCategory}
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                />
              </div>
              <div className="min-w-0">
                <label className="label">Quarter *</label>
                <SimpleSelect
                  aria-label="Quarter"
                  name="quarter"
                  required
                  value={newQuarter}
                  onChange={setNewQuarter}
                  options={QUARTERS.map(q => ({ value: q, label: q }))}
                />
              </div>
            </div>
            <div>
              <label className="label">Goal title *</label>
              <input
                name="title"
                required
                className="input"
                placeholder="e.g. Zero client-reported bugs for 4 consecutive weeks"
              />
            </div>
            <div>
              <label className="label">What does success look like? (measurable)</label>
              <input
                name="successMetric"
                className="input"
                placeholder="e.g. 4 weeks in a row with no client-reported bug"
              />
            </div>
            <div>
              <label className="label">Context / why this matters</label>
              <textarea name="description" rows={2} className="input" />
            </div>
            <div>
              <label className="label">Target date</label>
              <input name="targetDate" type="date" className="input date-input" />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={loading} className="btn-primary text-sm !px-3 !py-2">
                {loading ? '...' : 'Set goal'}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm !px-3 !py-2"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals by member */}
      {byMember.map(({ member: m, goals: mg }) => (
        <div key={m.id} className="mb-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2 px-0.5">
            <MemberNameLink
              memberId={m.id}
              name={m.name}
              canLink={canLinkMembers}
              className="text-sm font-semibold text-gray-800"
            />
            <span className="text-xs text-gray-400">{m.role}</span>
            <span className="text-xs text-gray-400">
              · {mg.length} goal{mg.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2.5">
            {mg.map(g => (
              <div
                key={g.id}
                className={`card p-3.5 sm:p-4 ${
                  g.status === 'achieved'
                    ? 'bg-green-50 border-green-100'
                    : g.status === 'missed'
                      ? 'bg-red-50 border-red-100'
                      : ''
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 break-words">{g.title}</span>
                      <span className={`badge text-xs ${CAT_COLORS[g.category] ?? 'bg-gray-100 text-gray-600'}`}>
                        {g.category}
                      </span>
                      <span className="text-xs text-gray-400">{g.quarter}</span>
                      {g.status === 'achieved' && (
                        <span className="badge bg-green-100 text-green-800 text-xs">✓ Achieved</span>
                      )}
                      {g.status === 'missed' && (
                        <span className="badge bg-red-100 text-red-800 text-xs">✗ Missed</span>
                      )}
                    </div>
                    {g.successMetric && (
                      <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1 mb-2 break-words">
                        ✓ Done when: {g.successMetric}
                      </p>
                    )}
                    {g.description && (
                      <p className="text-xs text-gray-500 mb-2 break-words">{g.description}</p>
                    )}

                    {g.status === 'active' && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-0">
                            <div
                              className={`h-full rounded-full transition-all ${
                                g.progressPct >= 80
                                  ? 'bg-green-500'
                                  : g.progressPct >= 50
                                    ? 'bg-amber-400'
                                    : 'bg-gray-300'
                              }`}
                              style={{ width: `${g.progressPct}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 tabular-nums shrink-0">
                            {g.progressPct}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          defaultValue={g.progressPct}
                          onChange={e => updateProgress(g.id, parseInt(e.target.value))}
                          className="w-full sm:w-24"
                        />
                      </div>
                    )}
                  </div>

                  {g.status === 'active' && (
                    <div className="flex flex-row sm:flex-col gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateStatus(g.id, 'achieved')}
                        className="text-xs px-2.5 py-1.5 bg-green-100 text-green-800 rounded-lg hover:bg-green-200"
                      >
                        Mark achieved
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStatus(g.id, 'missed')}
                        className="text-xs px-2.5 py-1.5 bg-red-100 text-red-800 rounded-lg hover:bg-red-200"
                      >
                        Mark missed
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {mg.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3.5 py-3 flex items-center justify-between gap-3">
                <p className="text-sm text-gray-500 min-w-0">No goals set yet.</p>
                <button
                  type="button"
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 shrink-0 whitespace-nowrap"
                  onClick={() => openNewFor(m.id)}
                >
                  Set one →
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {goals.length === 0 && !showNew && (
        <div className="card p-6 sm:p-10 text-center text-gray-400 text-sm">
          No goals set yet. Goals are the &quot;what good looks like&quot; target that weekly scores measure
          progress toward.
        </div>
      )}
    </div>
  )
}
