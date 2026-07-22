'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Member  = { id: string; name: string; role: string }
type Project = { id: string; name: string; clientName: string | null }
type Task    = {
  title: string; taskType: string; priority: string
  projectId: string; estimatedHours: string
}

const TASK_TYPES = ['feature','bug','backend','review','meeting','admin','qa','research']
const PRIORITIES = ['high','medium','low']
const PRIORITY_COLORS: Record<string,string> = {
  high:'border-red-300 bg-red-50', medium:'border-amber-200 bg-amber-50', low:'border-gray-200 bg-gray-50',
}
const emptyTask = (): Task => ({ title:'', taskType:'feature', priority:'medium', projectId:'', estimatedHours:'' })

export default function MorningPlanForm({
  member,
  projects,
  replanAfterEod = false,
  isEdit = false,
  initialTasks,
  initialPlanNotes = '',
}: {
  member: Member
  projects: Project[]
  replanAfterEod?: boolean
  isEdit?: boolean
  initialTasks?: Task[]
  initialPlanNotes?: string
}) {
  const [tasks, setTasks]         = useState<Task[]>(
    initialTasks?.length
      ? initialTasks.map(t =>
          member.role === 'SocialMedia' ? { ...t, projectId: '' } : t
        )
      : [emptyTask()]
  )
  const [planNotes, setPlanNotes] = useState(initialPlanNotes)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const router = useRouter()
  const hideProject = member.role === 'SocialMedia'

  const updateTask = useCallback((i: number, field: keyof Task, value: string) => {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }, [])

  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0)
  const canSubmit  = tasks.every(t => t.title.trim()) && tasks.length > 0

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
          tasks: hideProject
            ? tasks.map(t => ({ ...t, projectId: '' }))
            : tasks,
          replanAfterEod,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to submit plan' }))
        throw new Error(err.error ?? `Failed to submit plan (${res.status})`)
      }

      const data = await res.json()

      if (!data.id) {
        throw new Error('No log ID returned from server')
      }

      setLoading(false)
      router.replace(isEdit ? '/daily' : '/daily?saved=1')
      router.refresh()
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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {isEdit ? 'Edit today\'s plan' : replanAfterEod ? 'New plan for today' : 'Morning plan'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Submitting as: <strong>{member.name}</strong>
            {isEdit
              ? ' · Update tasks before you submit EOD'
              : replanAfterEod
                ? ' · Starting a fresh plan after EOD'
                : ' · Due by 9:30am'}
          </p>
        </div>
        <Link href="/daily" className="text-xs text-gray-400 hover:text-gray-700">← Daily view</Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl text-red-600">⚠</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Submission failed</h3>
              <p className="text-sm text-red-700">{error}</p>
              <p className="text-xs text-red-600 mt-1">Your entries are saved — fix the issue and submit again.</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600 text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {/* Task list */}
        <div className="space-y-3">
          {tasks.map((task, i) => (
            <div key={i} className={`card p-4 border-l-4 ${PRIORITY_COLORS[task.priority]}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task {i + 1}</span>
                {tasks.length > 1 && (
                  <button type="button" onClick={() => setTasks(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-400 hover:text-red-600">Remove</button>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">What will you do? *</label>
                  <textarea
                    value={task.title}
                    onChange={e => updateTask(i, 'title', e.target.value)}
                    required
                    rows={3}
                    className="input min-h-[80px]"
                    placeholder='Be specific — e.g. "Fix date picker bug on mobile Safari"'
                  />
                </div>
                <div className={`grid gap-2 ${hideProject ? 'grid-cols-3' : 'grid-cols-4'}`}>
                  <div>
                    <label className="label">Type</label>
                    <select value={task.taskType} onChange={e => updateTask(i,'taskType',e.target.value)} className="input">
                      {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select value={task.priority} onChange={e => updateTask(i,'priority',e.target.value)} className="input">
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  {!hideProject && (
                    <div>
                      <label className="label">Project</label>
                      <select value={task.projectId} onChange={e => updateTask(i,'projectId',e.target.value)} className="input">
                        <option value="">— None —</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label">Est. hours</label>
                    <input type="number" step="0.5" min="0.5" max="8" value={task.estimatedHours}
                      onChange={e => updateTask(i,'estimatedHours',e.target.value)}
                      className="input" placeholder="2" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hours + add task */}
        <div className="flex items-center justify-between px-1">
          <button type="button" onClick={() => setTasks(prev => [...prev, emptyTask()])}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            + Add another task
          </button>
          <div className={`text-sm font-medium ${totalHours > 8 ? 'text-red-600' : totalHours >= 6 ? 'text-green-700' : 'text-gray-500'}`}>
            {totalHours}h planned
            {totalHours > 8 && ' — over capacity'}
            {totalHours > 0 && totalHours < 3 && ' — consider adding more'}
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
            placeholder="Waiting on client response, need staging access, etc."
          />
        </div>

        <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full py-3 text-base">
          {loading
            ? (isEdit ? 'Saving changes...' : 'Locking in plan...')
            : isEdit
              ? `Save changes — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalHours}h`
              : `Submit plan — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalHours}h`}
        </button>
      </form>
    </div>
  )
}
