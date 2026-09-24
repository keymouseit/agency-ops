import { getApprovedOnLeaveToday } from '@/lib/leave-today'
import { getPendingLeaveRequests } from '@/lib/leave-pending'
import OnLeaveTodayCard from '@/components/OnLeaveTodayCard'
import PendingLeaveRequestsCard from '@/components/PendingLeaveRequestsCard'
import { businessDayStart } from '@/lib/daily'
import { formatIstWeekdayShort } from '@/lib/ist'

/** Streamed leave card — uses short-lived server cache. */
export default async function MeLeaveSection({
  showPending = false,
  className = 'mb-5 me-enter me-stagger-2',
}: {
  showPending?: boolean
  className?: string
}) {
  const [people, pending] = await Promise.all([
    getApprovedOnLeaveToday().catch(() => []),
    showPending ? getPendingLeaveRequests().catch(() => []) : Promise.resolve([]),
  ])

  return (
    <>
      {showPending ? <PendingLeaveRequestsCard initialRequests={pending} /> : null}
      <OnLeaveTodayCard
        people={people}
        dateLabel={formatIstWeekdayShort(businessDayStart())}
        className={className}
      />
    </>
  )
}

export function MeLeaveSectionFallback() {
  return (
    <div className="me-surface p-5 mb-0 h-full animate-pulse" aria-hidden>
      <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
      <div className="h-12 bg-gray-100 rounded-lg" />
    </div>
  )
}
