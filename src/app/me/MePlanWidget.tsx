'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function MePlanWidget() {
  const [expanded, setExpanded] = useState(false)

  // Simple state: show a prompt with two options
  return (
    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-blue-900">No morning plan submitted today.</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Plan your day before you start working. It takes 2 minutes.
          </p>
        </div>
        <Link
          href="/daily/plan"
          className="flex-shrink-0 ml-4 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
        >
          Plan my day →
        </Link>
      </div>

      {/* Quick tip */}
      <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-600">
        Tip: Be specific. &quot;Fix the date picker bug on iOS&quot; not &quot;work on app&quot;.
        Your EOD report will reference these tasks.
      </div>
    </div>
  )
}
