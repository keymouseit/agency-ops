import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { timeGreeting } from '@/lib/utils'
import { businessDayStart } from '@/lib/daily'
import { formatIstWeekdayLong, formatIstWeekdayShort } from '@/lib/ist'
import { getApprovedOnLeaveToday } from '@/lib/leave-today'
import OnLeaveTodayCard from '@/components/OnLeaveTodayCard'
import { DashboardKpiFallback, CardSectionFallback } from '@/components/SectionFallbacks'
import DashboardBody from './DashboardBody'

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
  const firstName = (session?.user?.name ?? '').split(' ')[0]

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {firstName ? `${timeGreeting()}, ${firstName}.` : timeGreeting()}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Here&apos;s everything that needs your attention today.
          </p>
        </div>
        <div className="text-xs text-gray-400">
          {formatIstWeekdayLong(new Date())}
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
