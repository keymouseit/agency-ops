'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  SALESROBOT_TABS,
  type SalesRobotTabId,
} from './salesrobot-tabs'
import { useWaitingCount } from './WaitingCountContext'

export default function SalesRobotTabs({
  active,
}: {
  active: SalesRobotTabId
}) {
  const searchParams = useSearchParams()
  const { count } = useWaitingCount()

  function hrefFor(tab: SalesRobotTabId) {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'analytics') params.delete('tab')
    else params.set('tab', tab)
    const q = params.toString()
    return q ? `/salesrobot?${q}` : '/salesrobot'
  }

  return (
    <div className="mb-6 inline-flex rounded-xl bg-gray-100 p-1 gap-1">
      {SALESROBOT_TABS.map(tab => {
        const isActive = active === tab.id
        return (
          <Link
            key={tab.id}
            href={hrefFor(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isActive
                ? 'bg-white shadow-sm ring-1 ring-gray-200 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
            }`}
          >
            {tab.label}
            {tab.id === 'waiting' && count > 0 && (
              <span
                className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                  isActive
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {count}
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
