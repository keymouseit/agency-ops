'use client'
import { useState } from 'react'
import Link from 'next/link'

type Task = {
  id: string
  title: string
  taskType: string
  priority: string
  estimatedHours: number | null
  status: string
  project: { name: string } | null
}

type Log = {
  id: string
  member: { name: string; role: string }
  tasks: Task[]
  eodSubmittedAt: Date | null
}

const TASK_STATUSES = [
  { value: 'done',    label: '✓ Done',    cls: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'partial', label: '½ Partial', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'blocked', label: '⊘ Blocked', cls: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'moved',   label: '→ Moved',   cls: 'bg-gray-100 text-gray-700 border-gray-200' },
]

type TaskUpdate = {
  status: string
  actualHours: string
  eodNotes: string
  blockedReason: string
}

export default function EODClient({ log }: { log: Log }) {
  const [taskUpdates, setTaskUpdates] = useState<Record<string, TaskUpdate>>(
    Object.fromEntries(log.tasks.map(t => [t.id, {
      status: t.status === 'planned' ? 'done' : t.status,
      actualHours: t.estimatedHours?.toString() ?? '',
      eodNotes: '',
      blockedReason: '',
    }]))
  )
  const [blockers, setBlockers] = useState('')
  const [carryOver, setCarryOver] = useState('')
  const [dayRating, setDayRating] = useState<number | null>(null)
  const [eodNotes, setEodNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(log.eodSubmittedAt !== null)

  function updateTask(id: string, field: keyof TaskUpdate, value: string) {
    setTaskUpdates(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const totalActual = Object.values(taskUpdates).reduce((s, t) => s + (parseFloat(t.actualHours) || 0), 0)
  const totalEst = log.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const doneCount = Object.values(taskUpdates).filter(t => t.status === 'done').length
  const blockedCount = Object.values(taskUpdates).filter(t => t.status === 'blocked').length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!dayRating) return
    setLoading(true)
    await fetch(`/api/daily/${log.id}/eod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskUpdates,
        blockers,
        carryOver,
        dayRating,
        eodNotes,
      }),
    })
    setLoading(false)
    setDone(true)
  }

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-5xl mb-4">🌙</div>
      <h1 className="text-2xl font-semibold mb-2">EOD submitted</h1>
      <p className="text-gray-500 mb-1">{log.member.name} — {doneCount} of {log.tasks.length} tasks done.</p>
      <p className="text-sm text-gray-400 mb-8">
        Need to keep working today? Start a new plan for the rest of the day.
      </p>
      <div className="flex gap-3 justify-center">
        <Link href="/daily/plan" className="btn-primary">Start new plan →</Link>
        <Link href="/daily" className="btn-secondary">Back to daily view →</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">EOD report</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {log.member.name} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}Due by 7pm
          </p>
        </div>
        <Link href="/daily" className="text-xs text-gray-400 hover:text-gray-700">← Team view</Link>
      </div>

      {/* Running summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-3 text-center">
          <div className="text-lg font-semibold text-green-700">{doneCount}</div>
          <div className="text-xs text-gray-400">Done</div>
        </div>
        <div className={`card p-3 text-center ${blockedCount > 0 ? 'bg-red-50' : ''}`}>
          <div className={`text-lg font-semibold ${blockedCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>{blockedCount}</div>
          <div className="text-xs text-gray-400">Blocked</div>
        </div>
        <div className="card p-3 text-center">
          <div className={`text-lg font-semibold ${totalActual > totalEst * 1.3 ? 'text-red-600' : 'text-gray-700'}`}>
            {totalActual > 0 ? `${totalActual}h` : '—'}
          </div>
          <div className="text-xs text-gray-400">Hours logged {totalEst > 0 ? `/ ${totalEst}h est` : ''}</div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Per-task updates */}
        <div className="space-y-3">
          {log.tasks.map(task => {
            const update = taskUpdates[task.id]
            return (
              <div key={task.id} className="card p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-800">{task.title}</div>
                    {task.project && <div className="text-xs text-gray-400">{task.project.name}</div>}
                  </div>
                  {task.estimatedHours && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{task.estimatedHours}h est.</span>
                  )}
                </div>

                {/* Status selector */}
                <div className="flex gap-2 mb-3">
                  {TASK_STATUSES.map(s => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => updateTask(task.id, 'status', s.value)}
                      className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                        update.status === s.value ? s.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Actual hours + notes */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label">Actual hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={update.actualHours}
                      onChange={e => updateTask(task.id, 'actualHours', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div className="col-span-2">
                    {update.status === 'blocked' ? (
                      <>
                        <label className="label text-red-600">Why blocked?</label>
                        <input
                          value={update.blockedReason}
                          onChange={e => updateTask(task.id, 'blockedReason', e.target.value)}
                          className="input border-red-200"
                          placeholder="Be specific about what's blocking this"
                        />
                      </>
                    ) : (
                      <>
                        <label className="label">Notes (optional)</label>
                        <input
                          value={update.eodNotes}
                          onChange={e => updateTask(task.id, 'eodNotes', e.target.value)}
                          className="input"
                          placeholder="What happened with this task?"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Day summary */}
        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Any blockers from today that carry forward?</label>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              rows={2}
              className="input mt-1"
              placeholder="Things that stopped you that need action tomorrow"
            />
          </div>
          <div>
            <label className="label">What carries to tomorrow?</label>
            <textarea
              value={carryOver}
              onChange={e => setCarryOver(e.target.value)}
              rows={2}
              className="input mt-1"
              placeholder="Tasks moving to tomorrow — and why"
            />
          </div>
          <div>
            <label className="label">Any other notes?</label>
            <textarea
              value={eodNotes}
              onChange={e => setEodNotes(e.target.value)}
              rows={1}
              className="input mt-1"
              placeholder="Anything else the team or founder should know"
            />
          </div>
        </div>

        {/* Day rating */}
        <div className="card p-5">
          <label className="label mb-3 block">How was your day? (1 = terrible, 5 = excellent)</label>
          <div className="flex gap-2">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setDayRating(n)}
                className={`flex-1 py-3 rounded-xl text-lg font-semibold border-2 transition-all ${
                  dayRating === n
                    ? n >= 4 ? 'bg-green-500 text-white border-green-500'
                      : n === 3 ? 'bg-amber-400 text-white border-amber-400'
                      : 'bg-red-400 text-white border-red-400'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
            <span>Bad day</span>
            <span>Great day</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !dayRating}
          className="btn-primary w-full py-3 text-base"
        >
          {loading ? 'Submitting...' : dayRating ? 'Submit EOD report ✓' : 'Rate your day first'}
        </button>
      </form>
    </div>
  )
}
