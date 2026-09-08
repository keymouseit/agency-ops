import { getApprovedOnLeaveToday } from '@/lib/leave-today'
import OnLeaveTodayCard from '@/components/OnLeaveTodayCard'
import { businessDayStart } from '@/lib/daily'
import { format } from 'date-fns'

/** Streamed leave card — uses short-lived server cache. */
export default async function MeLeaveSection() {
  const people = await getApprovedOnLeaveToday().catch(() => [])
  return (
    <OnLeaveTodayCard
      people={people}
      dateLabel={format(businessDayStart(), 'EEEE d MMM')}
    />
  )
}

export function MeLeaveSectionFallback() {
  return (
    <div className="card p-5 mb-6 animate-pulse" aria-hidden>
      <div className="h-4 w-40 bg-gray-200 rounded mb-3" />
      <div className="h-12 bg-gray-100 rounded-xl" />
    </div>
  )
}
