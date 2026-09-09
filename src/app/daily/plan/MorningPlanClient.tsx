'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MAX_DAILY_PLAN_HOURS, defaultDailyTaskType, dailyTaskTypeGroupsForRole } from '@/lib/daily'
import { useDailyTaskTypeCatalog, taskTypeGroupsForRole } from '@/hooks/useDailyTaskTypeGroups'
import { insertNewlineOnEnter } from '@/lib/multiline-input'
import { formatIstWeekdayLong } from '@/lib/ist'

type Member = { id: string; name: string; role: string }
type Project = { id: string; name: string; clientName: string | null }
type Task = {
  title: string
  taskType: string
  priority: string
  projectId: string
  estimatedHours: string
}

const PRIORITIES = ['high', 'medium', 'low']

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-red-300 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low: 'border-gray-200 bg-gray-50',
}

const emptyTask = (role = 'Dev'): Task => ({
  title: '', taskType: defaultDailyTaskType(role), priority: 'medium', projectId: '', estimatedHours: '',
})

export default function MorningPlanClient({
  members, projects, alreadySubmitted,
}: {
  members: Member[]
  projects: Project[]
  alreadySubmitted: string[]
}) {
  const [memberId, setMemberId] = useState('')
  const [tasks, setTasks] = useState<Task[]>([emptyTask()])
  const [planNotes, setPlanNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [logId, setLogId] = useState('')
  const catalog = useDailyTaskTypeCatalog()
  const router = useRouter()

  const member = members.find(m => m.id === memberId)
  const alreadyDone = alreadySubmitted.includes(memberId)

  function addTask() {
    setTasks(prev => [...prev, emptyTask(member?.role)])
  }

  function removeTask(i: number) {
    setTasks(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateTask(i: number, field: keyof Task, value: string) {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0)
  const canSubmit = memberId
    && tasks.every(t => t.title.trim() && parseFloat(t.estimatedHours) > 0)
    && !alreadyDone

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    const res = await fetch('/api/daily/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, planNotes, tasks }),
    })
    const data = await res.json()
    setLogId(data.id)
    setLoading(false)
    setDone(true)
  }

  if (done) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-5xl mb-4">☀</div>
      <h1 className="text-2xl font-semibold mb-2">Plan locked in</h1>
      <p className="text-gray-500 mb-1">
        {member?.name} — {tasks.length} task{tasks.length !== 1 ? 's' : ''}, {totalHours}h planned.
      </p>
      <p className="text-sm text-gray-400 mb-8">EOD report due by 7pm.</p>
      <div className="flex gap-3 justify-center">
        <Link href={`/daily/eod?logId=${logId}`} className="btn-secondary">Submit EOD now →</Link>
        <Link href="/daily" className="btn-primary">View team dashboard →</Link>
      </div>
    </div>
  )

  return (
    <div className="w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Morning plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {formatIstWeekdayLong(new Date())}
            {' · '}Due by 9:30am
          </p>
        </div>
        <Link href="/daily" className="text-xs text-gray-400 hover:text-gray-700">← Team view</Link>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Who are you */}
        <div className="card p-5">
          <label className="label">Who are you? *</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {members.map(m => {
              const done = alreadySubmitted.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => !done && setMemberId(m.id)}
                  disabled={done}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    memberId === m.id
                      ? 'border-gray-900 bg-gray-50'
                      : done
                      ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      : 'border-gray-100 hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{m.name.split(' ')[0]}</div>
                  <div className="text-xs text-gray-400">{m.role}</div>
                  {done && <div className="text-xs text-green-600 mt-0.5">✓ Submitted</div>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tasks */}
        {memberId && !alreadyDone && (
          <>
            <div className="space-y-3">
              {tasks.map((task, i) => (
                <div
                  key={i}
                  className={`card p-4 border-l-4 ${PRIORITY_COLORS[task.priority]}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Task {i + 1}
                    </span>
                    {tasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTask(i)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="label">What will you do? *</label>
                      <textarea
                        value={task.title}
                        onChange={e => updateTask(i, 'title', e.target.value)}
                        onKeyDown={e => insertNewlineOnEnter(e, next => updateTask(i, 'title', next))}
                        required
                        rows={3}
                        className="input min-h-[80px]"
                        placeholder={'Be specific — use Enter for new lines\ne.g. Fix booking API\nAdd unit tests'}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="label">Type</label>
                        <select
                          value={task.taskType}
                          onChange={e => updateTask(i, 'taskType', e.target.value)}
                          className="input"
                        >
                          {(taskTypeGroupsForRole(catalog, member?.role ?? 'Dev', task.taskType) ?? dailyTaskTypeGroupsForRole(member?.role ?? 'Dev', task.taskType)).map(group => (
                            <optgroup key={group.label} label={group.label}>
                              {group.types.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label">Priority</label>
                        <select
                          value={task.priority}
                          onChange={e => updateTask(i, 'priority', e.target.value)}
                          className="input"
                        >
                          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Project</label>
                        <select
                          value={task.projectId}
                          onChange={e => updateTask(i, 'projectId', e.target.value)}
                          className="input"
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
                        <label className="label">Est. hours</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          value={task.estimatedHours}
                          onChange={e => updateTask(i, 'estimatedHours', e.target.value)}
                          required
                          className="input"
                          placeholder="2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Hours summary */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={addTask}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add another task
              </button>
              <div className={`text-sm font-medium ${totalHours > MAX_DAILY_PLAN_HOURS ? 'text-amber-600' : totalHours >= 6 ? 'text-green-700' : 'text-gray-500'}`}>
                {totalHours}h planned
                {totalHours > MAX_DAILY_PLAN_HOURS && ' — over a standard workday'}
                {totalHours > 0 && totalHours <= 4 && ' — add more tasks'}
              </div>
            </div>

            {/* Plan notes */}
            <div className="card p-5">
              <label className="label">Anything blocking today before you start?</label>
              <textarea
                value={planNotes}
                onChange={e => setPlanNotes(e.target.value)}
                rows={4}
                className="input mt-1 min-h-[100px]"
                placeholder="Waiting on client response, need access to staging server, etc."
              />
            </div>

            {/* Validation warning */}
            {totalHours > 0 && totalHours < 3 && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
                You&apos;ve planned {totalHours}h — consider adding more tasks for a fuller day.
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="btn-primary w-full py-3 text-base"
            >
              {loading ? 'Locking in plan...' : `Submit plan — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalHours}h`}
            </button>
          </>
        )}

        {alreadyDone && memberId && (
          <div className="card p-6 text-center text-sm text-gray-500">
            You already submitted your morning plan today.
            <br />
            <Link href="/daily" className="text-blue-600 hover:underline mt-2 block">View team dashboard →</Link>
          </div>
        )}
      </form>
    </div>
  )
}
