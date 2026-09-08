'use client'

import { useEffect, useState } from 'react'

export default function LeaveHourPolicyCard() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-white ring-1 ring-gray-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-sm transition-colors"
        aria-label="Attendance and leave hour requirements"
        title="Rules & regulations"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden="true">
          <path
            d="M8 4h9.5A1.5 1.5 0 0 1 19 5.5v14A1.5 1.5 0 0 1 17.5 21H8"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M8 4a2 2 0 0 0-2 2v13.5A1.5 1.5 0 0 0 7.5 21H8"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path d="M11 8h5M11 12h5M11 16h3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
        <span className="text-xs font-semibold">Rules</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-hour-policy-title"
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg ring-1 ring-gray-900/5 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Rules &amp; regulations
                </p>
                <h2 id="leave-hour-policy-title" className="text-lg font-bold text-gray-900 mt-0.5">
                  Attendance &amp; leave hour requirements
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 text-sm text-gray-600 leading-relaxed">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-amber-50/80 ring-1 ring-amber-100 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Half day</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">4.5 hours</p>
                  <p className="text-xs text-gray-600 mt-1">Minimum working hours required</p>
                </div>
                <div className="rounded-xl bg-sky-50/80 ring-1 ring-sky-100 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Short leave</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5 tabular-nums">7 hours</p>
                  <p className="text-xs text-gray-600 mt-1">Minimum working hours required</p>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Half day</p>
                <p>
                  A minimum of 4.5 working hours is mandatory to qualify for a Half Day.
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Short leave</p>
                <p>
                  A minimum of 7 working hours is mandatory to qualify for a Short Leave.
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Cannot be combined
                </p>
                <p>
                  Half day and short leave cannot be taken together on the same day.
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                  Below minimum hours
                </p>
                <p>
                  If an employee works for less than the minimum required hours, the attendance cannot be treated
                  as a valid Half Day or Short Leave. The hours worked will not be considered as leave and cannot
                  be used to compensate for short working hours on another day.
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 ring-1 ring-gray-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Example</p>
                <p>
                  If an employee reports to work for only 2 hours, those 2 hours cannot be counted as a working
                  day, Half Day, Short Leave, or as compensatory hours against a future shortfall. The employee
                  must meet the applicable minimum working-hour requirement for the attendance category to be
                  considered valid.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
