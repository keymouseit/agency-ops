'use client'

import { useState } from 'react'
import Link from 'next/link'
import { canEditEod } from '@/lib/daily'
import EODHeader from './EODHeader'

type Task = {
  id: string
  title: string
  taskType: string
  priority: string
  estimatedHours: number | null
  status: string
  actualHours: number | null
  eodNotes: string | null
  blockedReason: string | null
  project: { name: string } | null
}

type Log = {
  id: string
  date: string | Date
  member: { name: string; role: string }
  tasks: Task[]
  eodSubmittedAt: Date | string | null
  blockers: string | null
  carryOver: string | null
  dayRating: number | null
  eodNotes: string | null
}

const TASK_STATUSES = [
  { value: 'done', label: '✓ Done', active: 'bg-green-600 text-white border-green-600', idle: 'border-green-200 text-green-700 hover:bg-green-50' },
  { value: 'partial', label: '½ Partial', active: 'bg-amber-500 text-white border-amber-500', idle: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { value: 'blocked', label: '⊘ Blocked', active: 'bg-red-600 text-white border-red-600', idle: 'border-red-200 text-red-700 hover:bg-red-50' },
  { value: 'moved', label: '→ Moved', active: 'bg-gray-600 text-white border-gray-600', idle: 'border-gray-200 text-gray-600 hover:bg-gray-50' },
] as const

const STATUS_BADGE: Record<string, string> = {
  done: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
  moved: 'bg-gray-100 text-gray-700',
}

type TaskUpdate = {
  status: string
  actualHours: string
  eodNotes: string
  blockedReason: string
}

function buildTaskUpdates(tasks: Task[], forEdit: boolean): Record<string, TaskUpdate> {
  return Object.fromEntries(
    tasks.map(t => [
      t.id,
      {
        status: forEdit ? t.status : t.status === 'planned' ? 'done' : t.status,
        actualHours: (forEdit ? t.actualHours : t.estimatedHours)?.toString() ?? '',
        eodNotes: forEdit ? (t.eodNotes ?? '') : '',
        blockedReason: forEdit ? (t.blockedReason ?? '') : '',
      },
    ])
  )
}

function EODStats({
  doneCount,
  blockedCount,
  totalActual,
  totalEst,
  dayRating,
}: {
  doneCount: number
  blockedCount: number
  totalActual: number
  totalEst: number
  dayRating?: number | null
}) {
  const stats = [
    { label: 'Done', value: doneCount.toString(), icon: '✅', good: doneCount > 0 },
    { label: 'Blocked', value: blockedCount.toString(), icon: '🚫', bad: blockedCount > 0 },
    {
      label: 'Hours logged',
      value: totalActual > 0 ? `${totalActual}h` : '—',
      sub: totalEst > 0 ? `/ ${totalEst}h est` : undefined,
      icon: '⏱',
      bad: totalActual > totalEst * 1.3 && totalEst > 0,
    },
    ...(dayRating != null
      ? [{ label: 'Day rating', value: `${dayRating}/5`, icon: '⭐' as const }]
      : []),
  ]

  return (
    <div className={`grid gap-3 mb-6 ${stats.length === 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}>
      {stats.map(stat => (
        <div
          key={stat.label}
          className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{stat.label}</div>
            <span className="text-base opacity-80" aria-hidden>
              {stat.icon}
            </span>
          </div>
          <div
            className={`text-xl font-semibold tabular-nums ${
              stat.bad ? 'text-red-600' : stat.good ? 'text-green-700' : 'text-gray-900'
            }`}
          >
            {stat.value}
            {'sub' in stat && stat.sub && (
              <span className="text-sm font-normal text-gray-400 ml-1">{stat.sub}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function DayRatingPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (n: number) => void
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-base shrink-0">
          ⭐
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">How was your day?</p>
          <p className="text-xs text-gray-500 mt-0.5">1 = terrible · 5 = excellent — required to submit</p>
        </div>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-xl text-lg font-semibold border-2 transition-all ${
              value === n
                ? n >= 4
                  ? 'bg-green-500 text-white border-green-500 shadow-sm'
                  : n === 3
                    ? 'bg-amber-400 text-white border-amber-400 shadow-sm'
                    : 'bg-red-400 text-white border-red-400 shadow-sm'
                : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
        <span>Bad day</span>
        <span>Great day</span>
      </div>
    </div>
  )
}

export default function EODClient({
  log,
  readOnly = false,
}: {
  log: Log
  readOnly?: boolean
}) {
  const isEditMode = !!log.eodSubmittedAt && !readOnly
  const [taskUpdates, setTaskUpdates] = useState<Record<string, TaskUpdate>>(() =>
    buildTaskUpdates(log.tasks, isEditMode)
  )
  const [blockers, setBlockers] = useState(log.blockers ?? '')
  const [carryOver, setCarryOver] = useState(log.carryOver ?? '')
  const [dayRating, setDayRating] = useState<number | null>(log.dayRating)
  const [eodNotes, setEodNotes] = useState(log.eodNotes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [justUpdated, setJustUpdated] = useState(false)

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
    setError('')
    try {
      const res = await fetch(`/api/daily/${log.id}/eod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskUpdates, blockers, carryOver, dayRating, eodNotes }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit EOD')

      if (isEditMode) {
        setJustUpdated(true)
      } else {
        setShowSuccess(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit EOD')
    } finally {
      setLoading(false)
    }
  }

  if (readOnly) {
    return (
      <div className="w-full mx-auto">
        <EODHeader
          memberName={log.member.name}
          memberRole={log.member.role}
          date={log.date}
          isEditMode={false}
          readOnly
          eodSubmittedAt={log.eodSubmittedAt}
        />
        <ReadOnlySummary
          log={log}
          doneCount={log.tasks.filter(t => t.status === 'done').length}
          blockedCount={log.tasks.filter(t => t.status === 'blocked').length}
        />
      </div>
    )
  }

  if (showSuccess) {
    const canEditAgain = canEditEod(new Date())
    return (
      <div className="py-8">
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-indigo-50/40 p-10 sm:p-14 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl text-white shadow-sm">
            🌙
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">EOD submitted</h1>
          <p className="text-gray-500 mb-1">
            {log.member.name} — {doneCount} of {log.tasks.length} tasks done.
          </p>
          <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
            {canEditAgain
              ? 'Made a mistake? You can edit your EOD until the end of today.'
              : 'Need to keep working today? Start a new plan for the rest of the day.'}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {canEditAgain && (
              <Link href={`/daily/eod?logId=${log.id}`} className="btn-secondary text-sm">
                Edit EOD
              </Link>
            )}
            <Link href="/daily/plan" className="btn-primary text-sm">
              Start new plan →
            </Link>
            <Link href="/daily" className="btn-secondary text-sm">
              Back to daily view
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full mx-auto">
      <EODHeader
        memberName={log.member.name}
        memberRole={log.member.role}
        date={log.date}
        isEditMode={isEditMode}
      />

      {justUpdated && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span aria-hidden>✓</span>
          EOD updated successfully.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-4">
          {log.tasks.map((task, i) => {
            const update = taskUpdates[task.id]
            const statusStyle = TASK_STATUSES.find(s => s.value === update.status)
            return (
              <div
                key={task.id}
                className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-sm shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 whitespace-pre-line truncate">
                        {task.title}
                      </div>
                      {task.project && (
                        <div className="text-xs text-gray-400 truncate">{task.project.name}</div>
                      )}
                    </div>
                  </div>
                  {task.estimatedHours != null && task.estimatedHours > 0 && (
                    <span className="text-xs text-gray-400 shrink-0 tabular-nums">{task.estimatedHours}h est.</span>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="label mb-2">Status</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TASK_STATUSES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => updateTask(task.id, 'status', s.value)}
                          className={`py-2 px-2 text-xs rounded-lg border font-medium transition-colors ${
                            update.status === s.value ? s.active : s.idle
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-[120px_1fr] gap-4">
                    <div>
                      <label className="label">Actual hours</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={update.actualHours}
                        onChange={e => updateTask(task.id, 'actualHours', e.target.value)}
                        className="input bg-gray-50/50 focus:bg-white tabular-nums"
                      />
                    </div>
                    <div>
                      {update.status === 'blocked' ? (
                        <>
                          <label className="label text-red-600">Why blocked?</label>
                          <textarea
                            value={update.blockedReason}
                            onChange={e => updateTask(task.id, 'blockedReason', e.target.value)}
                            rows={3}
                            className="input border-red-200 bg-red-50/30 focus:bg-white min-h-[80px]"
                            placeholder="Be specific about what's blocking this"
                          />
                        </>
                      ) : (
                        <>
                          <label className="label">Notes (optional)</label>
                          <textarea
                            value={update.eodNotes}
                            onChange={e => updateTask(task.id, 'eodNotes', e.target.value)}
                            rows={3}
                            className="input bg-gray-50/50 focus:bg-white min-h-[80px]"
                            placeholder="What happened with this task?"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {statusStyle && (
                    <div className="text-[11px] text-gray-400">
                      Marked as <span className="font-medium text-gray-600">{statusStyle.label}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
          <p className="text-sm font-semibold text-gray-900">Day wrap-up</p>

          <div>
            <div className="flex items-start gap-3 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-base shrink-0">
                🚧
              </span>
              <div>
                <label className="text-sm font-medium text-gray-900">
                  Any blockers from today that carry forward?
                </label>
                <p className="text-xs text-gray-500">Things that stopped you and need action tomorrow.</p>
              </div>
            </div>
            <textarea
              value={blockers}
              onChange={e => setBlockers(e.target.value)}
              rows={3}
              className="input min-h-[80px] bg-gray-50/50 focus:bg-white"
              placeholder="Waiting on client sign-off, staging access, etc."
            />
          </div>

          <div>
            <div className="flex items-start gap-3 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-base shrink-0">
                →
              </span>
              <div>
                <label className="text-sm font-medium text-gray-900">What carries to tomorrow?</label>
                <p className="text-xs text-gray-500">Tasks moving forward — and why.</p>
              </div>
            </div>
            <textarea
              value={carryOver}
              onChange={e => setCarryOver(e.target.value)}
              rows={3}
              className="input min-h-[80px] bg-gray-50/50 focus:bg-white"
              placeholder="Finish API integration — blocked on review"
            />
          </div>

          <div>
            <div className="flex items-start gap-3 mb-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-base shrink-0">
                💬
              </span>
              <div>
                <label className="text-sm font-medium text-gray-900">Any other notes?</label>
                <p className="text-xs text-gray-500">Anything else the team or founder should know.</p>
              </div>
            </div>
            <textarea
              value={eodNotes}
              onChange={e => setEodNotes(e.target.value)}
              rows={3}
              className="input min-h-[80px] bg-gray-50/50 focus:bg-white"
              placeholder="Shipped v2 to staging, demo prep went well"
            />
          </div>
        </div>

        <DayRatingPicker value={dayRating} onChange={setDayRating} />

        <button
          type="submit"
          disabled={loading || !dayRating}
          className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading
            ? 'Saving...'
            : isEditMode
              ? `Update EOD — ${doneCount} done, ${totalActual}h logged`
              : dayRating
                ? `Submit EOD — ${doneCount} done, ${totalActual}h logged`
                : 'Rate your day to submit'}
        </button>
      </form>
    </div>
  )
}

function ReadOnlySummary({
  log,
  doneCount,
  blockedCount,
}: {
  log: Log
  doneCount: number
  blockedCount: number
}) {
  const totalActual = log.tasks.reduce((s, t) => s + (t.actualHours ?? 0), 0)
  const totalEst = log.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)

  return (
    <div className="space-y-5">
      <EODStats
        doneCount={doneCount}
        blockedCount={blockedCount}
        totalActual={totalActual}
        totalEst={totalEst}
        dayRating={log.dayRating}
      />

      <div className="space-y-4">
        {log.tasks.map((task, i) => {
          const status = TASK_STATUSES.find(s => s.value === task.status)
          return (
            <div key={task.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600 shrink-0">
                    {i + 1}
                  </span>
                  <div className="text-sm font-medium text-gray-800 whitespace-pre-line">{task.title}</div>
                </div>
                <span className={`badge text-[11px] shrink-0 ${STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {status?.label ?? task.status}
                </span>
              </div>
              {task.actualHours != null && (
                <p className="text-xs text-gray-500 tabular-nums">{task.actualHours}h logged</p>
              )}
              {task.eodNotes && (
                <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">{task.eodNotes}</p>
              )}
              {task.blockedReason && (
                <p className="text-xs text-red-600 mt-2 whitespace-pre-wrap">Blocked: {task.blockedReason}</p>
              )}
            </div>
          )
        })}
      </div>

      {(log.blockers || log.carryOver || log.eodNotes) && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 space-y-4 text-sm text-gray-700">
          {log.blockers && (
            <div>
              <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Blockers</div>
              <p className="whitespace-pre-wrap text-blue-800">{log.blockers}</p>
            </div>
          )}
          {log.carryOver && (
            <div>
              <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Carry over</div>
              <p className="whitespace-pre-wrap text-blue-800">{log.carryOver}</p>
            </div>
          )}
          {log.eodNotes && (
            <div>
              <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Notes</div>
              <p className="whitespace-pre-wrap text-blue-800">{log.eodNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
