'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MAX_DAILY_PLAN_HOURS, defaultDailyTaskType, dailyTaskTypeGroupsForRole } from '@/lib/daily'
import { useDailyTaskTypeCatalog, taskTypeGroupsForRole } from '@/hooks/useDailyTaskTypeGroups'
import { insertNewlineOnEnter } from '@/lib/multiline-input'
import MorningPlanHeader from './MorningPlanHeader'

type Member = { id: string; name: string; role: string }
type Project = { id: string; name: string; clientName: string | null }
type Task = {
  title: string
  taskType: string
  priority: string
  projectId: string
  estimatedHours: string
}

const PRIORITIES = ['high', 'medium', 'low'] as const

const PRIORITY_STYLES: Record<string, { ring: string; badge: string; pill: string; pillActive: string }> = {
  high: {
    ring: 'ring-red-200',
    badge: 'bg-red-100 text-red-800',
    pill: 'border-red-200 text-red-700 hover:bg-red-50',
    pillActive: 'bg-red-600 text-white border-red-600',
  },
  medium: {
    ring: 'ring-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    pill: 'border-amber-200 text-amber-700 hover:bg-amber-50',
    pillActive: 'bg-amber-500 text-white border-amber-500',
  },
  low: {
    ring: 'ring-gray-200',
    badge: 'bg-gray-100 text-gray-700',
    pill: 'border-gray-200 text-gray-600 hover:bg-gray-50',
    pillActive: 'bg-gray-600 text-white border-gray-600',
  },
}

const emptyTask = (role: string): Task => ({
  title: '',
  taskType: defaultDailyTaskType(role),
  priority: 'medium',
  projectId: '',
  estimatedHours: '',
})

function HoursSummary({ totalHours, taskCount }: { totalHours: number; taskCount: number }) {
  const pct = Math.min(100, (totalHours / MAX_DAILY_PLAN_HOURS) * 100)
  const barColor =
    totalHours > MAX_DAILY_PLAN_HOURS
      ? 'bg-amber-500'
      : totalHours >= 6
        ? 'bg-green-500'
        : totalHours >= 3
          ? 'bg-blue-400'
          : 'bg-gray-300'

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Day load</span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            totalHours > MAX_DAILY_PLAN_HOURS
              ? 'text-amber-700'
              : totalHours >= 6
                ? 'text-green-700'
                : 'text-gray-700'
          }`}
        >
          {totalHours}h / {MAX_DAILY_PLAN_HOURS}h
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {taskCount} task{taskCount !== 1 ? 's' : ''}
        {totalHours > MAX_DAILY_PLAN_HOURS && ' · Over a standard workday'}
        {totalHours > 0 && totalHours < 3 && ' · Consider adding more tasks'}
      </p>
    </div>
  )
}

export default function MorningPlanForm({
  member,
  projects,
  replanAfterEod = false,
  isEdit = false,
  initialTasks,
  initialPlanNotes = '',
  carryOverFromDate,
}: {
  member: Member
  projects: Project[]
  replanAfterEod?: boolean
  isEdit?: boolean
  initialTasks?: Task[]
  initialPlanNotes?: string
  carryOverFromDate?: string
}) {
  const [tasks, setTasks] = useState<Task[]>(
    initialTasks?.length ? initialTasks : [emptyTask(member.role)]
  )
  const [planNotes, setPlanNotes] = useState(initialPlanNotes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const catalog = useDailyTaskTypeCatalog()
  const router = useRouter()

  const updateTask = useCallback((i: number, field: keyof Task, value: string) => {
    setTasks(prev => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)))
  }, [])

  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0)
  const canSubmit = tasks.every(t => t.title.trim() && parseFloat(t.estimatedHours) > 0) && tasks.length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/daily/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planNotes,
          tasks,
          replanAfterEod,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to submit plan' }))
        throw new Error(err.error ?? `Failed to submit plan (${res.status})`)
      }

      const data = await res.json()
      if (!data.id) throw new Error('No log ID returned from server')

      setLoading(false)
      router.replace(isEdit ? '/daily' : '/daily?saved=1')
    } catch (err) {
      setLoading(false)
      if (err instanceof TypeError) {
        setError('Could not reach the server. Check your connection and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to submit plan. Please try again.')
      }
    }
  }

  return (
    <div className="w-full mx-auto">
      <MorningPlanHeader
        memberName={member.name}
        memberRole={member.role}
        isEdit={isEdit}
        replanAfterEod={replanAfterEod}
      />

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0" aria-hidden>
              ⚠️
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Submission failed</h3>
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-1">Your entries are saved — fix the issue and submit again.</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 text-sm shrink-0"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {carryOverFromDate && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          <span className="font-semibold">Prefilled from partial / moved tasks</span>
          <span className="text-slate-600"> · {carryOverFromDate}&apos;s EOD. Edit or add more before submitting.</span>
        </div>
      )}

      {!isEdit && !replanAfterEod && !carryOverFromDate && (
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
          <span className="font-semibold">Tip:</span> Be specific — &quot;Fix the date picker bug on iOS&quot; beats
          &quot;work on app&quot;. Your EOD report will reference these tasks.
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-4">
          {tasks.map((task, i) => {
            const p = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium
            return (
              <div
                key={i}
                className={`rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden ring-1 ${p.ring}`}
              >
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-sm">
                      {i + 1}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</span>
                    <span className={`badge text-[11px] ${p.badge}`}>{task.priority}</span>
                  </div>
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTasks(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-xs font-medium text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="label">What will you do? *</label>
                    <textarea
                      value={task.title}
                      onChange={e => updateTask(i, 'title', e.target.value)}
                      onKeyDown={e => insertNewlineOnEnter(e, next => updateTask(i, 'title', next))}
                      required
                      rows={3}
                      className="input min-h-[88px] bg-gray-50/50 focus:bg-white"
                      placeholder={'Be specific — use Enter for new lines\ne.g. 1. Fix DOB picker\n2. Test dark mode'}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Enter = new line</p>
                  </div>

                  <div>
                    <label className="label mb-2">Priority</label>
                    <div className="flex flex-wrap gap-2">
                      {PRIORITIES.map(priority => {
                        const styles = PRIORITY_STYLES[priority]
                        const active = task.priority === priority
                        return (
                          <button
                            key={priority}
                            type="button"
                            onClick={() => updateTask(i, 'priority', priority)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-colors ${
                              active ? styles.pillActive : styles.pill
                            }`}
                          >
                            {priority}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    <div>
                      <label className="label">Type</label>
                      <select
                        value={task.taskType}
                        onChange={e => updateTask(i, 'taskType', e.target.value)}
                        className="input bg-gray-50/50 focus:bg-white"
                      >
                        {(taskTypeGroupsForRole(catalog, member.role, task.taskType) ?? dailyTaskTypeGroupsForRole(member.role, task.taskType)).map(group => (
                          <optgroup key={group.label} label={group.label}>
                            {group.types.map(t => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Project</label>
                      <select
                        value={task.projectId}
                        onChange={e => updateTask(i, 'projectId', e.target.value)}
                        className="input bg-gray-50/50 focus:bg-white"
                      >
                        <option value="">— None —</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Est. hours *</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        value={task.estimatedHours}
                        onChange={e => updateTask(i, 'estimatedHours', e.target.value)}
                        required
                        className="input bg-gray-50/50 focus:bg-white tabular-nums"
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setTasks(prev => [...prev, emptyTask(member.role)])}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            Add another task
          </button>
          <div className="sm:w-56">
            <HoursSummary totalHours={totalHours} taskCount={tasks.length} />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-base shrink-0">
              🚧
            </span>
            <div>
              <label className="text-sm font-semibold text-gray-900">
                Anything blocking today before you start?
              </label>
              <p className="text-xs text-gray-500 mt-0.5">Optional — flag blockers so your team can help early.</p>
            </div>
          </div>
          <textarea
            value={planNotes}
            onChange={e => setPlanNotes(e.target.value)}
            onKeyDown={e => insertNewlineOnEnter(e, setPlanNotes)}
            rows={3}
            className="input min-h-[88px] bg-gray-50/50 focus:bg-white"
            placeholder="Waiting on client response, need staging access, etc."
          />
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading
            ? isEdit
              ? 'Saving changes...'
              : 'Locking in plan...'
            : isEdit
              ? `Save changes — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalHours}h`
              : `Submit plan — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalHours}h`}
        </button>
      </form>
    </div>
  )
}
