'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { fmtDate } from '@/lib/utils'
import { istDateInputValue } from '@/lib/ist'

const NO_FURTHER_STATUSES = ['Hold', 'Closed'] as const

type NextPath = 'schedule_next' | 'no_further'

export default function MomFollowUpButton({
  id,
  followUpDate,
  completedAt,
  followUpOutcome = null,
}: {
  id: string
  followUpDate: string
  completedAt: string | null
  followUpOutcome?: string | null
}) {
  const [done, setDone] = useState(!!completedAt)
  const [completedOn, setCompletedOn] = useState(completedAt)
  const [outcomeText, setOutcomeText] = useState(followUpOutcome)
  const [createdFollowUpId, setCreatedFollowUpId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const today = istDateInputValue()
  const [attendedDate, setAttendedDate] = useState(today)
  const [outcome, setOutcome] = useState('')
  const [nextPath, setNextPath] = useState<NextPath>('schedule_next')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [finalStatus, setFinalStatus] = useState<(typeof NO_FURTHER_STATUSES)[number]>('Hold')

  const router = useRouter()

  useEffect(() => {
    setDone(!!completedAt)
    setCompletedOn(completedAt)
    setOutcomeText(followUpOutcome)
  }, [completedAt, followUpOutcome])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) close()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, loading])

  function resetForm() {
    setAttendedDate(istDateInputValue())
    setOutcome('')
    setNextPath('schedule_next')
    setNextFollowUpDate('')
    setFinalStatus('Hold')
    setError('')
    setFieldErrors({})
  }

  function close() {
    if (loading) return
    setOpen(false)
    resetForm()
  }

  function validate(): boolean {
    const errors: Record<string, string> = {}
    const trimmed = outcome.trim()
    if (!trimmed) {
      errors.outcome = 'Outcome is required (at least one line).'
    }
    if (!attendedDate) {
      errors.attendedDate = 'Confirm the call date.'
    }
    if (nextPath === 'schedule_next') {
      if (!nextFollowUpDate) {
        errors.nextFollowUpDate = 'Pick the next call date.'
      } else {
        // Next call must be on/after today, or on/after attended date if attended is later.
        const requiredMin = attendedDate && attendedDate > today ? attendedDate : today
        if (nextFollowUpDate < requiredMin) {
          errors.nextFollowUpDate = `Next call date must be on or after ${requiredMin}.`
        }
      }
    } else if (finalStatus !== 'Hold' && finalStatus !== 'Closed') {
      errors.finalStatus = 'Choose Hold or Closed when ending further calls.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function submit() {
    setError('')
    if (!validate()) return

    setLoading(true)
    const body: Record<string, unknown> = {
      followUpCompleted: true,
      attendedDate,
      outcome: outcome.trim(),
      nextAction: nextPath,
    }
    if (nextPath === 'schedule_next') {
      body.nextFollowUpDate = nextFollowUpDate
    } else {
      body.finalStatus = finalStatus
    }

    try {
      const res = await fetch(`/api/mom/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(
          typeof data.error === 'string' && data.error.trim()
            ? data.error
            : 'Could not complete next call.'
        )
        return
      }

      const data = await res.json()
      const newId =
        typeof data.newFollowUpMomId === 'string' && data.newFollowUpMomId
          ? data.newFollowUpMomId
          : null
      setDone(!!data.followUpCompletedAt)
      setCompletedOn(data.followUpCompletedAt ?? null)
      setOutcomeText(typeof data.followUpOutcome === 'string' ? data.followUpOutcome : outcome.trim())
      setCreatedFollowUpId(newId)
      setOpen(false)
      resetForm()
      if (nextPath === 'schedule_next' && newId) {
        toast.success(
          t => (
            <span>
              Next call logged. Follow-up MOM created.{' '}
              <a
                href={`/mom/${newId}`}
                className="underline font-semibold"
                onClick={() => toast.dismiss(t.id)}
              >
                Open
              </a>
            </span>
          ),
          { duration: 8000 },
        )
      } else if (nextPath === 'no_further') {
        toast.success('Next call completed — no further call scheduled.')
      }
      router.refresh()
    } catch {
      setError('Could not complete next call.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50/80 p-4">
        <div className="flex items-start gap-2.5">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold shrink-0 mt-0.5">
            ✓
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-green-700/70 font-medium">Next call</div>
            <div className="text-sm font-medium text-green-900">
              {createdFollowUpId
                ? 'Next call logged. Follow-up MOM created.'
                : 'Next call completed — no further call scheduled'}
            </div>
            {createdFollowUpId && (
              <div className="text-xs text-green-800 mt-1">
                <Link href={`/mom/${createdFollowUpId}`} className="underline font-medium hover:text-green-950">
                  Open follow-up MOM →
                </Link>
              </div>
            )}
            {completedOn && (
              <div className="text-xs text-green-700/80 mt-0.5">
                Marked complete on {fmtDate(new Date(completedOn))}
              </div>
            )}
            {outcomeText && (
              <p className="text-xs text-green-800/90 mt-2 whitespace-pre-wrap leading-relaxed border-t border-green-100 pt-2">
                {outcomeText}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">Next call</div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5">
              Scheduled for {fmtDate(new Date(followUpDate))}
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed max-w-xl">
              Completing logs the call outcome and either creates a follow-up MOM for the next call date or closes/holds the deal.
              This is separate from Deal status alone.
            </p>
            {outcomeText && (
              <p className="text-xs text-gray-600 mt-2 whitespace-pre-wrap border-t border-gray-100 pt-2">
                Previous outcome: {outcomeText}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm()
              setOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors shrink-0"
          >
            Complete next call
          </button>
        </div>
        {error && !open && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={close}
          role="presentation"
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-next-call-title"
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <h2 id="complete-next-call-title" className="text-base font-semibold text-gray-900">
                  Complete next call
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Confirm the call happened, log the outcome, then schedule the next call or end follow-ups.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none px-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="attendedDate">
                  Call happened on
                </label>
                <input
                  id="attendedDate"
                  type="date"
                  value={attendedDate}
                  max={today}
                  onChange={e => setAttendedDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                {fieldErrors.attendedDate && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.attendedDate}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="outcome">
                  Outcome <span className="text-red-500">*</span>
                </label>
                <input
                  id="outcome"
                  type="text"
                  value={outcome}
                  onChange={e => setOutcome(e.target.value)}
                  placeholder="Short summary of what happened on the call"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                {fieldErrors.outcome && (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.outcome}</p>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-gray-700 mb-1">What next?</legend>
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-slate-400 has-[:checked]:bg-slate-50">
                  <input
                    type="radio"
                    name="nextPath"
                    checked={nextPath === 'schedule_next'}
                    onChange={() => setNextPath('schedule_next')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">Schedule next call</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Logs this call and creates a new follow-up MOM for the next call date.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 has-[:checked]:border-slate-400 has-[:checked]:bg-slate-50">
                  <input
                    type="radio"
                    name="nextPath"
                    checked={nextPath === 'no_further'}
                    onChange={() => setNextPath('no_further')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-900">No further call</span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Marks this next call done and sets Deal status to Hold or Closed.
                    </span>
                  </span>
                </label>
              </fieldset>

              {nextPath === 'schedule_next' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="nextFollowUpDate">
                    Next call date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="nextFollowUpDate"
                    type="date"
                    value={nextFollowUpDate}
                    min={attendedDate && attendedDate > today ? attendedDate : today}
                    onChange={e => setNextFollowUpDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                  {fieldErrors.nextFollowUpDate && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.nextFollowUpDate}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="finalStatus">
                    Deal status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="finalStatus"
                    value={finalStatus}
                    onChange={e =>
                      setFinalStatus(e.target.value as (typeof NO_FURTHER_STATUSES)[number])
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  >
                    {NO_FURTHER_STATUSES.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Active / Waiting Response / Demo statuses remain available on Deal status when you schedule another call.
                  </p>
                  {fieldErrors.finalStatus && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.finalStatus}</p>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap">
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={loading}
                className="px-3.5 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                aria-busy={loading || undefined}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  'Save & complete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
