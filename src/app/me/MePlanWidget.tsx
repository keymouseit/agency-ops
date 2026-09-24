'use client'

import Link from 'next/link'

export default function MePlanWidget({ movedCount = 0 }: { movedCount?: number }) {
  if (movedCount > 0) {
    return (
      <div className="me-callout me-callout-warn">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Morning plan not started</p>
            <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
              Carried-over tasks above will open already filled in. Add or edit as needed.
            </p>
          </div>
          <Link
            href="/daily/plan"
            className="me-btn-premium me-btn-premium-dark inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 shrink-0"
          >
            Open plan
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="me-surface-quiet rounded-lg border border-gray-200/80 bg-gray-50/40 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 tracking-tight">
            Start your morning plan
          </p>
          <p className="text-sm text-gray-500 mt-1 max-w-md leading-relaxed">
            List what you&apos;ll work on today — about two minutes. Your EOD will check against this list.
          </p>
        </div>
        <Link
          href="/daily/plan"
          className="me-btn-premium me-btn-premium-dark inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 shrink-0"
        >
          Plan my day
        </Link>
      </div>

      <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-200/80 pt-4">
        {[
          { n: '1', t: 'Add tasks' },
          { n: '2', t: 'Set hours' },
          { n: '3', t: 'Submit plan' },
        ].map(step => (
          <li key={step.n} className="flex items-center gap-2 text-xs text-gray-600">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white border border-gray-200 text-[10px] font-semibold text-gray-700 tabular-nums">
              {step.n}
            </span>
            <span className="font-medium">{step.t}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
