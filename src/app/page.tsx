import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { timeGreeting } from '@/lib/utils'
import { businessDayStart } from '@/lib/daily'
import { formatIstWeekdayLong, formatIstWeekdayShort } from '@/lib/ist'
import { getApprovedOnLeaveToday } from '@/lib/leave-today'
import OnLeaveTodayCard from '@/components/OnLeaveTodayCard'
import { DashboardKpiFallback, CardSectionFallback } from '@/components/SectionFallbacks'
import DashboardBody from './DashboardBody'
import { shortDisplayName } from '@/lib/employee-order'

export const dynamic = 'force-dynamic'

async function DashboardLeave() {
  const people = await getApprovedOnLeaveToday().catch(() => [])
  return (
    <OnLeaveTodayCard
      people={people}
      dateLabel={formatIstWeekdayShort(businessDayStart())}
      className="h-full"
    />
  )
}

export default async function Dashboard() {
  const session = await auth()
  const firstName = shortDisplayName(session?.user?.name ?? '')

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight">
              {firstName ? `${timeGreeting()}, ${firstName}.` : timeGreeting()}
            </h1>
            <p className="text-sm text-gray-500 mt-1 sm:mt-0.5 leading-snug">
              Here&apos;s everything that needs your attention today.
            </p>
          </div>
          <p className="text-xs text-gray-400 tabular-nums sm:text-right shrink-0 pt-0.5">
            {formatIstWeekdayLong(new Date())}
          </p>
        </div>
      </div>

      <Suspense fallback={<DashboardKpiFallback />}>
        <DashboardBody>
          <Suspense fallback={<CardSectionFallback className="h-full mb-0" />}>
            <DashboardLeave />
          </Suspense>
        </DashboardBody>
      </Suspense>
    </div>
  )
}
