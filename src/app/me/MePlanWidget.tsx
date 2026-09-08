'use client'

import Link from 'next/link'

export default function MePlanWidget({ movedCount = 0 }: { movedCount?: number }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white text-lg shadow-sm shrink-0">
            ☀️
          </span>
          <div>
            <p className="text-sm font-semibold text-blue-950">No morning plan yet</p>
            <p className="text-xs text-blue-700 mt-1 max-w-md">
              {movedCount > 0
                ? `${movedCount} moved task${movedCount === 1 ? '' : 's'} from yesterday will be prefilled when you plan.`
                : 'Plan your day before you start working — it takes about 2 minutes and keeps your team in sync.'}
            </p>
          </div>
        </div>
        <Link
          href="/daily/plan"
          className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
        >
          {movedCount > 0 ? 'Plan with moved tasks →' : 'Plan my day →'}
        </Link>
      </div>

      <div className="mt-4 rounded-lg bg-white/70 border border-blue-100 px-3 py-2.5 text-xs text-blue-800">
        <span className="font-medium">Tip:</span> Be specific — &quot;Fix the date picker bug on iOS&quot; beats &quot;work on app&quot;.
        Your EOD report will reference these tasks.
      </div>
    </div>
  )
}
