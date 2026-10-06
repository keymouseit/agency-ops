'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { istDateInputValue } from '@/lib/ist'

type Props = {
  userId: string
  /** Monday week bucket as YYYY-MM-DD (IST). */
  weekKey: string
  /** When true, offer the lightweight Friday first-visit modal. */
  isFriday?: boolean
}

function dismissKey(userId: string, weekKey: string, dayKey: string) {
  return `weeklyScoreBannerDismiss:${userId}:${weekKey}:${dayKey}`
}

function modalKey(userId: string, weekKey: string, dayKey: string) {
  return `weeklyScoreModalSeen:${userId}:${weekKey}:${dayKey}`
}

function ButtonSpinner() {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-white/40 border-t-white animate-spin"
      aria-hidden="true"
    />
  )
}

/**
 * Amber/indigo due banner for weekly self-score (Tue–Fri IST; see WEEKLY_SCORE_BANNER_DAYS).
 * "Later" dismisses for the rest of the IST calendar day via localStorage.
 * Optional small Friday modal — first time per day, non-blocking.
 */
export default function WeeklyScoreBanner({ userId, weekKey, isFriday = false }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [ready, setReady] = useState(false)
  const [hidden, setHidden] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    try {
      const dayKey = istDateInputValue(new Date())
      const dismissed = localStorage.getItem(dismissKey(userId, weekKey, dayKey)) === '1'
      setHidden(dismissed)

      if (isFriday && !dismissed) {
        const seen = localStorage.getItem(modalKey(userId, weekKey, dayKey)) === '1'
        if (!seen) {
          localStorage.setItem(modalKey(userId, weekKey, dayKey), '1')
          setModalOpen(true)
        }
      }
    } catch {
      setHidden(false)
    }
    setReady(true)
  }, [userId, weekKey, isFriday])

  function dismissForToday() {
    try {
      const dayKey = istDateInputValue(new Date())
      localStorage.setItem(dismissKey(userId, weekKey, dayKey), '1')
    } catch {
      /* ignore quota / private mode */
    }
    setHidden(true)
    setModalOpen(false)
  }

  function goCheckin() {
    startTransition(() => {
      router.push('/checkin')
    })
  }

  if (!ready || hidden) return null

  const body = (
    <>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-indigo-950">Your weekly score is due</div>
        <p className="text-xs text-indigo-900/75 mt-0.5 leading-relaxed">
          Takes 1 minute: rate this week on delivery, process, communication, growth and culture.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={dismissForToday}
          className="text-xs font-medium text-indigo-800/70 hover:text-indigo-950 px-2 py-1.5 rounded-lg"
        >
          Later
        </button>
        <button
          type="button"
          disabled={isPending}
          aria-busy={isPending}
          onMouseEnter={() => router.prefetch('/checkin')}
          onFocus={() => router.prefetch('/checkin')}
          onClick={goCheckin}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50 whitespace-nowrap"
        >
          {isPending ? <ButtonSpinner /> : null}
          <span className="inline-block min-w-[5.5rem] text-center">
            {isPending ? 'Opening…' : 'Submit now'}
          </span>
        </button>
      </div>
    </>
  )

  return (
    <>
      <div
        role="status"
        className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-indigo-200 bg-gradient-to-br from-amber-50/90 to-indigo-50/80 px-3.5 py-3 shadow-[0_1px_2px_rgb(15_23_42_/_0.03)]"
      >
        {body}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weekly-score-modal-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-indigo-200 bg-white p-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 id="weekly-score-modal-title" className="text-base font-semibold text-gray-900">
              Your weekly score is due
            </h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              Takes 1 minute: rate this week on delivery, process, communication, growth and culture.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2.5 py-1.5 rounded-lg"
              >
                Not now
              </button>
              <button
                type="button"
                disabled={isPending}
                aria-busy={isPending}
                onClick={goCheckin}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
              >
                {isPending ? <ButtonSpinner /> : null}
                {isPending ? 'Opening…' : 'Submit now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
