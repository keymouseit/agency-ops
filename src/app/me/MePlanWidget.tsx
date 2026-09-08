'use client'

import Link from 'next/link'

export default function MePlanWidget({ movedCount = 0 }: { movedCount?: number }) {
  if (movedCount > 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-4 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Morning plan not started</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Your carried-over tasks above will open already filled in. Add or edit as needed.
            </p>
          </div>
          <Link
            href="/daily/plan"
            className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors shrink-0"
          >
            Open plan →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-5 shadow-sm">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-200/40 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-white text-lg shadow-sm shrink-0">
            ✦
          </span>
          <div>
            <p className="text-base font-semibold text-gray-900 tracking-tight">Start your morning plan</p>
            <p className="text-sm text-gray-600 mt-1 max-w-md leading-relaxed">
              List what you’ll work on today — about two minutes. Your EOD will check against this list.
            </p>
          </div>
        </div>
        <Link
          href="/daily/plan"
          className="inline-flex items-center justify-center rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-sky-800 transition-colors shrink-0"
        >
          Plan my day →
        </Link>
      </div>

      <div className="relative mt-4 grid gap-2 sm:grid-cols-3">
        {[
          { n: '1', t: 'Add tasks' },
          { n: '2', t: 'Set hours' },
          { n: '3', t: 'Submit plan' },
        ].map(step => (
          <div
            key={step.n}
            className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-sky-100"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-800">
              {step.n}
            </span>
            <span className="text-xs font-medium text-gray-700">{step.t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
