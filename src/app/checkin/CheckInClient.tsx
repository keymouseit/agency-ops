'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ROLE_COLORS, STATUS_COLORS } from '@/lib/utils'
import { checkInProjectsForMember, type CheckInProject } from '@/lib/checkin'

type Member = { id: string; name: string; role: string }

export type ThisWeekCheckIn = {
  id: string
  projectId: string
  projectName: string
  progressPct: number
  onTrack: string
  scopeChange: string
  clientUpdated: boolean
  blockers: string | null
  notes: string | null
  createdAt: string
}

export type ThisWeekSelfScore = {
  id: string
  delivery: number
  process: number
  communication: number
  growth: number
  culture: number
  selfNotes: string | null
  repeatedMistake: boolean
  createdAt: string
}

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

const ON_TRACK_LABELS: Record<string, string> = {
  yes: 'On track',
  at_risk: 'At risk',
  no: 'Off track',
}

const SCOPE_LABELS: Record<string, string> = {
  none: 'None',
  logged: 'Logged with change order',
  unlogged: 'Not logged yet',
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

function CheckInDetailModal({
  checkIn,
  onClose,
}: {
  checkIn: ThisWeekCheckIn
  onClose: () => void
}) {
  const onTrackCls = STATUS_COLORS[checkIn.onTrack] ?? 'bg-gray-100 text-gray-700'
  const onTrackLabel = ON_TRACK_LABELS[checkIn.onTrack] ?? checkIn.onTrack.replace('_', ' ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-detail-title"
    >
      <div
        className="flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">This week&apos;s check-in</p>
            <h2 id="checkin-detail-title" className="mt-0.5 truncate text-base font-semibold text-gray-900">
              {checkIn.projectName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-xs text-gray-500">Progress</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-900">{checkIn.progressPct}%</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <p className="text-xs text-gray-500">Deadline</p>
              <span className={`badge mt-1 text-xs ${onTrackCls}`}>{onTrackLabel}</span>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Scope changes</p>
            <p className="font-medium text-gray-800">
              {SCOPE_LABELS[checkIn.scopeChange] ?? checkIn.scopeChange}
            </p>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Client updated</p>
            <p className="font-medium text-gray-800">{checkIn.clientUpdated ? 'Yes' : 'No'}</p>
          </div>

          {checkIn.blockers ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">Blockers</p>
              <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-amber-900">
                {checkIn.blockers}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1">Blockers</p>
              <p className="text-gray-400">None noted</p>
            </div>
          )}

          {checkIn.notes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-gray-800 whitespace-pre-wrap">{checkIn.notes}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function SubmittedCheckInCards({
  checkIns,
  onOpen,
}: {
  checkIns: ThisWeekCheckIn[]
  onOpen: (ci: ThisWeekCheckIn) => void
}) {
  if (checkIns.length === 0) return null

  return (
    <section aria-label="Submitted check-ins this week">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Submitted this week</h3>
        <span className="text-xs font-medium text-gray-500 tabular-nums">
          {checkIns.length} check-in{checkIns.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {checkIns.map(ci => {
          const onTrackCls = STATUS_COLORS[ci.onTrack] ?? 'bg-gray-100 text-gray-700'
          const onTrackLabel = ON_TRACK_LABELS[ci.onTrack] ?? ci.onTrack.replace('_', ' ')
          return (
            <button
              key={ci.id}
              type="button"
              onClick={() => onOpen(ci)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">{ci.projectName}</h4>
                <span className="shrink-0 text-xs text-blue-600 font-medium">View →</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium tabular-nums text-gray-700">{ci.progressPct}% progress</span>
                <span className={`badge text-[10px] ${onTrackCls}`}>{onTrackLabel}</span>
                {ci.blockers && (
                  <span className="badge text-[10px] bg-amber-50 text-amber-800">Has blockers</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CheckInHeader({
  memberName,
  memberRole,
  step,
  selfDone = false,
  projectCheckInCount = 0,
  onSelectStep,
}: {
  memberName: string
  memberRole: string
  step: 'project' | 'self' | 'done'
  selfDone?: boolean
  projectCheckInCount?: number
  onSelectStep: (s: 'project' | 'self') => void
}) {
  const roleCls = ROLE_COLORS[memberRole] ?? 'bg-gray-100 text-gray-700'
  const activeStep: 'project' | 'self' = step === 'self' ? 'self' : 'project'

  const tabs: { id: 'project' | 'self'; label: string; done: boolean; meta?: string }[] = [
    {
      id: 'project',
      label: 'Project check-in',
      done: projectCheckInCount > 0,
      meta: projectCheckInCount > 0 ? `${projectCheckInCount} submitted` : undefined,
    },
    {
      id: 'self',
      label: 'Self-assessment',
      done: selfDone,
      meta: selfDone ? 'Submitted' : undefined,
    },
  ]

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

        <div
          className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 border border-gray-200 self-start"
          role="tablist"
          aria-label="Check-in type"
        >
          {tabs.map(tab => {
            const active = activeStep === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectStep(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab.label}
                  {tab.done && (
                    <span className="inline-flex items-center gap-0.5 text-green-600" title={tab.meta}>
                      <span aria-hidden>✓</span>
                      <span className="sr-only">{tab.meta ?? 'Done'}</span>
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function SubmittedSelfScoreCard({
  score,
  onOpen,
}: {
  score: ThisWeekSelfScore
  onOpen: () => void
}) {
  const vals = DIMS.map(d => score[d])
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length

  return (
    <section aria-label="Submitted self-assessment this week">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Submitted this week</h3>
        <span className="text-xs font-medium text-green-700">Done ✓</span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-900">Weekly self-assessment</h4>
          <span className="shrink-0 text-xs text-blue-600 font-medium">View →</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium tabular-nums text-gray-700">
            Avg {avg.toFixed(1)}/10
          </span>
          {DIMS.map(d => (
            <span key={d} className="badge text-[10px] bg-gray-100 text-gray-700">
              {DIM_LABELS[d]} {score[d]}
            </span>
          ))}
          {score.repeatedMistake && (
            <span className="badge text-[10px] bg-amber-50 text-amber-800">Repeated mistake</span>
          )}
        </div>
      </button>
    </section>
  )
}

function SelfScoreDetailModal({
  score,
  onClose,
}: {
  score: ThisWeekSelfScore
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-score-detail-title"
    >
      <div
        className="flex w-full max-w-md max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">This week&apos;s check-in</p>
            <h2 id="self-score-detail-title" className="mt-0.5 text-base font-semibold text-gray-900">
              Self-assessment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="grid grid-cols-1 gap-2">
            {DIMS.map(d => (
              <div
                key={d}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{DIM_LABELS[d]}</p>
                  <p className="text-xs text-gray-500">{DIM_HINTS[d]}</p>
                </div>
                <span className="text-lg font-semibold tabular-nums text-gray-900">{score[d]}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Repeated a mistake from last week?</p>
            <p className="font-medium text-gray-800">{score.repeatedMistake ? 'Yes' : 'No'}</p>
          </div>

          {score.selfNotes ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">One thing you could have done better</p>
              <p className="text-gray-800 whitespace-pre-wrap">{score.selfNotes}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-gray-400">None noted</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CheckInClient({
  members,
  projects,
  thisWeekCheckIns: thisWeekCheckInsProp = [],
  selfScoreDone: selfScoreDoneProp = false,
  thisWeekSelfScore: thisWeekSelfScoreProp = null,
  initialStep = 'project',
}: {
  members: Member[]
  projects: CheckInProject[]
  thisWeekCheckIns?: ThisWeekCheckIn[]
  selfScoreDone?: boolean
  thisWeekSelfScore?: ThisWeekSelfScore | null
  initialStep?: 'project' | 'self'
}) {
  const { data: session } = useSession()
  const [step, setStep] = useState<'project' | 'self' | 'done'>(initialStep)
  const [memberId, setMemberId] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [weekCheckIns, setWeekCheckIns] = useState<ThisWeekCheckIn[]>(thisWeekCheckInsProp)
  const [selfDone, setSelfDone] = useState(selfScoreDoneProp)
  const [selfScore, setSelfScore] = useState<ThisWeekSelfScore | null>(thisWeekSelfScoreProp)
  const [lastProjectName, setLastProjectName] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [detailCheckIn, setDetailCheckIn] = useState<ThisWeekCheckIn | null>(null)
  const [showSelfDetail, setShowSelfDetail] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (session?.user?.id) {
      setMemberId(session.user.id)
    }
  }, [session])

  const member = members.find(m => m.id === memberId)
  const myProjects = useMemo(
    () => (member ? checkInProjectsForMember(projects, memberId, member.role) : []),
    [member, projects, memberId],
  )
  const completedSet = useMemo(() => new Set(weekCheckIns.map(c => c.projectId)), [weekCheckIns])
  const remainingProjects = useMemo(
    () => myProjects.filter(p => !completedSet.has(p.id)),
    [myProjects, completedSet],
  )
  const ratedCount = DIMS.filter(d => scores[d]).length
  const allProjectsDone = myProjects.length > 0 && remainingProjects.length === 0
  const nothingLeft = (myProjects.length === 0 || remainingProjects.length === 0) && selfDone

  function openNewCheckInForm() {
    setError('')
    setLastProjectName(null)
    setFormKey(k => k + 1)
    setShowForm(true)
    setStep('project')
  }

  function selectStep(next: 'project' | 'self') {
    setError('')
    setShowForm(false)
    setStep(next)
  }

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
            setError(
              err.error ??
                'You already submitted a check-in for this project this week. Pick a different project.',
            )
            return
          }
          throw new Error(err.error ?? `Failed to submit project status (${res.status})`)
        }

        const created = await res.json().catch(() => null)
        const projectName = myProjects.find(p => p.id === projectId)?.name ?? 'Project'
        const newEntry: ThisWeekCheckIn = {
          id: created?.id ?? `local-${projectId}-${Date.now()}`,
          projectId,
          projectName,
          progressPct: created?.progressPct ?? parseInt(String(fd.get('progressPct') ?? '0'), 10),
          onTrack: created?.onTrack ?? String(fd.get('onTrack') ?? 'yes'),
          scopeChange: created?.scopeChange ?? String(fd.get('scopeChange') ?? 'none'),
          clientUpdated:
            typeof created?.clientUpdated === 'boolean'
              ? created.clientUpdated
              : fd.get('clientUpdated') === 'true',
          blockers: created?.blockers ?? (fd.get('blockers') ? String(fd.get('blockers')) : null),
          notes: created?.notes ?? null,
          createdAt: created?.createdAt ?? new Date().toISOString(),
        }
        setWeekCheckIns(prev => (prev.some(c => c.projectId === projectId) ? prev : [newEntry, ...prev]))
        setLastProjectName(projectName)
        setShowForm(false)
      }
      setLoading(false)
      if (selfDone) {
        setStep('done')
      } else {
        setStep('self')
      }
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
          setSelfDone(true)
          setSelfScore(prev =>
            prev ?? {
              id: `local-self-${Date.now()}`,
              delivery: scores.delivery ?? 5,
              process: scores.process ?? 5,
              communication: scores.communication ?? 5,
              growth: scores.growth ?? 5,
              culture: scores.culture ?? 5,
              selfNotes: fd.get('selfNotes') ? String(fd.get('selfNotes')) : null,
              repeatedMistake: fd.get('repeatedMistake') === 'true',
              createdAt: new Date().toISOString(),
            },
          )
          setLoading(false)
          setStep('self')
          return
        }
        throw new Error(err.error ?? `Failed to submit check-in (${res.status})`)
      }

      const created = await res.json().catch(() => null)
      const saved: ThisWeekSelfScore = {
        id: created?.id ?? `local-self-${Date.now()}`,
        delivery: Number(created?.delivery ?? scores.delivery ?? 5),
        process: Number(created?.process ?? scores.process ?? 5),
        communication: Number(created?.communication ?? scores.communication ?? 5),
        growth: Number(created?.growth ?? scores.growth ?? 5),
        culture: Number(created?.culture ?? scores.culture ?? 5),
        selfNotes:
          created?.selfNotes ?? (fd.get('selfNotes') ? String(fd.get('selfNotes')) : null),
        repeatedMistake:
          typeof created?.repeatedMistake === 'boolean'
            ? created.repeatedMistake
            : fd.get('repeatedMistake') === 'true',
        createdAt: created?.createdAt ?? new Date().toISOString(),
      }
      setSelfScore(saved)
      setSelfDone(true)
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
      <CheckInHeader
        memberName={member.name}
        memberRole={member.role}
        step={step}
        selfDone={selfDone}
        projectCheckInCount={weekCheckIns.length}
        onSelectStep={selectStep}
      />

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

      {(step === 'project' || step === 'done') && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-gray-100 text-base shadow-sm">
                  📁
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Project check-ins</h2>
                  <p className="text-xs text-gray-500">
                    Hi {member.name.split(' ')[0]} — only this week&apos;s submissions
                    {myProjects.length > 0
                      ? ` · ${weekCheckIns.length}/${myProjects.length} projects`
                      : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {step === 'done' && (
              <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-3 text-center sm:text-left">
                <p className="text-sm font-medium text-green-900">
                  {lastProjectName ? `Saved status for ${lastProjectName}.` : 'Check-in saved.'}
                  {remainingProjects.length > 0
                    ? ` ${remainingProjects.length} project${remainingProjects.length === 1 ? '' : 's'} still left this week.`
                    : selfDone
                      ? ' You are done for this week.'
                      : ''}
                </p>
              </div>
            )}

            <SubmittedCheckInCards checkIns={weekCheckIns} onOpen={setDetailCheckIn} />

            {myProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center">
                <p className="text-sm font-medium text-gray-700 mb-1">No projects assigned to you</p>
                <p className="text-xs text-gray-500 mb-4">
                  {selfDone
                    ? 'Nothing left for this week.'
                    : 'Skip to self-assessment — you can still submit your weekly scores.'}
                </p>
                {!selfDone ? (
                  <button type="button" className="btn-primary" onClick={() => setStep('self')}>
                    Continue to self-assessment →
                  </button>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => router.push('/me')}>
                    Back to My Day →
                  </button>
                )}
              </div>
            ) : (
              <>
                {!showForm && remainingProjects.length > 0 && (
                  <button type="button" onClick={openNewCheckInForm} className="btn-primary w-full sm:w-auto">
                    + Add check-in
                  </button>
                )}

                {!showForm && allProjectsDone && (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center">
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      All your projects are checked in this week
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      {selfDone
                        ? 'Next week starts fresh — last week&apos;s check-ins won&apos;t show here.'
                        : 'Continue to finish your weekly self-assessment.'}
                    </p>
                    {!selfDone ? (
                      <button type="button" className="btn-primary" onClick={() => setStep('self')}>
                        Continue to self-assessment →
                      </button>
                    ) : (
                      <button type="button" className="btn-primary" onClick={() => router.push('/me')}>
                        Back to My Day →
                      </button>
                    )}
                  </div>
                )}

                {showForm && remainingProjects.length > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 sm:p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-gray-900">New project check-in</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForm(false)
                          setError('')
                        }}
                        className="text-xs font-medium text-gray-500 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                    <form key={formKey} onSubmit={submitProject} className="space-y-5">
                      <div>
                        <label className="label">Select project</label>
                        <select name="projectId" className="input bg-white" required defaultValue="">
                          <option value="" disabled>
                            Choose a project…
                          </option>
                          {remainingProjects.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Projects already checked in this week are hidden.
                        </p>
                      </div>

                      <div>
                        <label className="label">Progress this week (%)</label>
                        <input
                          name="progressPct"
                          type="number"
                          min="0"
                          max="100"
                          required
                          className="input bg-white tabular-nums"
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
                        <select name="scopeChange" className="input bg-white">
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
                          className="input bg-white"
                          placeholder="What's slowing you down?"
                        />
                      </div>

                      <button type="submit" disabled={loading} className="btn-primary w-full py-3 disabled:opacity-50">
                        {loading
                          ? 'Saving…'
                          : selfDone
                            ? 'Save project check-in ✓'
                            : 'Save & continue →'}
                      </button>
                    </form>
                  </div>
                )}

                {step === 'done' && remainingProjects.length > 0 && !showForm && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                    <button type="button" onClick={openNewCheckInForm} className="btn-primary">
                      Check in another project →
                    </button>
                    <button type="button" onClick={() => router.push('/me')} className="btn-secondary">
                      Back to My Day →
                    </button>
                  </div>
                )}

                {nothingLeft && step === 'done' && (
                  <div className="flex justify-center sm:justify-start">
                    <button type="button" onClick={() => router.push('/me')} className="btn-primary">
                      Back to My Day →
                    </button>
                  </div>
                )}
              </>
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
                  <p className="text-xs text-gray-500">
                    {selfDone ? 'Submitted for this week — tap to view' : '1 = very poor · 10 = excellent'}
                  </p>
                </div>
              </div>
              {selfDone ? (
                <span className="badge bg-green-100 text-green-800 text-[11px]">Done ✓</span>
              ) : (
                <span className="badge bg-gray-100 text-gray-600 text-[11px]">{ratedCount}/5 rated</span>
              )}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {selfDone ? (
              <>
                {selfScore ? (
                  <SubmittedSelfScoreCard score={selfScore} onOpen={() => setShowSelfDetail(true)} />
                ) : (
                  <div className="rounded-xl border border-green-100 bg-green-50/60 px-4 py-4 text-sm text-green-900">
                    Self-assessment already submitted for this week.
                  </div>
                )}
                {remainingProjects.length > 0 && (
                  <button type="button" className="btn-secondary" onClick={() => selectStep('project')}>
                    ← Back to project check-ins
                  </button>
                )}
                {remainingProjects.length === 0 && (
                  <button type="button" onClick={() => router.push('/me')} className="btn-primary">
                    Back to My Day →
                  </button>
                )}
              </>
            ) : (
              <form onSubmit={submitSelf} className="space-y-5">
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
            )}
          </div>
        </div>
      )}

      {detailCheckIn && (
        <CheckInDetailModal checkIn={detailCheckIn} onClose={() => setDetailCheckIn(null)} />
      )}

      {showSelfDetail && selfScore && (
        <SelfScoreDetailModal score={selfScore} onClose={() => setShowSelfDetail(false)} />
      )}
    </div>
  )
}
