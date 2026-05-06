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

const TASK_TYPES = ['feature','bug','review','meeting','admin','qa','research']
const PRIORITIES = ['high','medium','low']
const PRIORITY_COLORS: Record<string,string> = {
  high:'border-red-300 bg-red-50', medium:'border-amber-200 bg-amber-50', low:'border-gray-200 bg-gray-50',
}
const emptyTask = (): Task => ({ title:'', taskType:'feature', priority:'medium', projectId:'', estimatedHours:'' })

export default function MorningPlanForm({
  member, projects,
}: {
  member: Member
  projects: Project[]
}) {
  const [tasks, setTasks]         = useState<Task[]>([emptyTask()])
  const [planNotes, setPlanNotes] = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [logId, setLogId]         = useState('')
  const router = useRouter()

  const updateTask = useCallback((i: number, field: keyof Task, value: string) => {
    setTasks(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }, [])

  const totalHours = tasks.reduce((s, t) => s + (parseFloat(t.estimatedHours) || 0), 0)
  const canSubmit  = tasks.every(t => t.title.trim()) && tasks.length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    const res = await fetch('/api/daily/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // memberId comes from the session on the server — but the API still needs it
      // We pass it here for the existing API contract; the server validates via auth
      body: JSON.stringify({ memberId: member.id, planNotes, tasks }),
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
        {member.name.split(' ')[0]} — {tasks.length} task{tasks.length !== 1 ? 's' : ''}, {totalHours}h planned.
      </p>
      <p className="text-sm text-gray-400 mb-8">EOD report due by 7pm.</p>
      <div className="flex gap-3 justify-center">
        <Link href={`/daily/eod?logId=${logId}`} className="btn-secondary">Submit EOD now →</Link>
        <Link href="/me" className="btn-primary">My Day →</Link>
      </div>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Morning plan</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {member.name} · Due by 9:30am
          </p>
        </div>
        <Link href="/me" className="text-xs text-gray-400 hover:text-gray-700">← My Day</Link>
      </div>

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
                  <input value={task.title} onChange={e => updateTask(i,'title',e.target.value)}
                    required className="input"
                    placeholder='Be specific — e.g. "Fix date picker bug on mobile Safari"' />
                </div>
                <div className="grid grid-cols-4 gap-2">
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
                  <div>
                    <label className="label">Project</label>
                    <select value={task.projectId} onChange={e => updateTask(i,'projectId',e.target.value)} className="input">
                      <option value="">— None —</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
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
          <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)}
            rows={2} className="input mt-1"
            placeholder="Waiting on client response, need staging access, etc." />
        </div>

        <button type="submit" disabled={loading || !canSubmit} className="btn-primary w-full py-3 text-base">
          {loading ? 'Locking in plan...' : `Submit plan — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}, ${totalHours}h`}
        </button>
      </form>
    </div>
  )
}
