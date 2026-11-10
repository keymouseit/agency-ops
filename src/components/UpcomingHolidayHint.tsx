import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import { businessDayKey } from '@/lib/daily'
import {
  daysBetweenDateKeys,
  dateKeyToDbDate,
  getUpcomingHolidays,
  HOLIDAY_TYPE_LABELS,
  isNonWorkingHolidayType,
  UPCOMING_HOLIDAY_WINDOW_DAYS,
  type HolidayEntry,
} from '@/lib/holidays'

function formatHolidayDate(dateKey: string) {
  // Holiday dates are pure calendar keys — format in UTC so the day never shifts.
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dateKeyToDbDate(dateKey))
}

function countdownLabel(days: number) {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days} days`
}

function typeNote(h: HolidayEntry) {
  return isNonWorkingHolidayType(h.type) ? HOLIDAY_TYPE_LABELS[h.type] : `${HOLIDAY_TYPE_LABELS[h.type]} · optional`
}

/**
 * Dashboard countdown for the next holiday (lead home `/` and My Day `/me`).
 * Only renders when the next holiday is ≤ UPCOMING_HOLIDAY_WINDOW_DAYS (15) IST days away;
 * if a second one is also in the window it gets a short mention. Computed per request
 * (noStore) from today's IST date, so the count drops by one each day.
 */
export default async function UpcomingHolidayHint({ className = '' }: { className?: string }) {
  noStore()
  const todayKey = businessDayKey()
  let holidays: HolidayEntry[] = []
  try {
    holidays = await getUpcomingHolidays(todayKey, UPCOMING_HOLIDAY_WINDOW_DAYS)
  } catch {
    return null
  }
  // Sunday-type rows are already weekends; no countdown for them.
  holidays = holidays
    .filter(h => h.type !== 'sunday')
    .filter(h => {
      const d = daysBetweenDateKeys(todayKey, h.date)
      return d >= 0 && d <= UPCOMING_HOLIDAY_WINDOW_DAYS
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  if (holidays.length === 0) return null

  const [next, after] = holidays
  const days = daysBetweenDateKeys(todayKey, next.date)
  const isToday = days === 0

  return (
    <div
      className={`mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 ${className}`}
    >
      <div className="min-w-0 text-sm text-indigo-900">
        <div>
          <span aria-hidden className="mr-1.5">🎉</span>
          <span className="font-semibold">{isToday ? 'Holiday today:' : 'Next holiday:'}</span> {next.name} ·{' '}
          {formatHolidayDate(next.date)}
          {!isToday && (
            <>
              {' '}—{' '}
              <span className="font-semibold tabular-nums">{countdownLabel(days)}</span>
            </>
          )}
          <span className="text-indigo-600/80 text-xs"> ({typeNote(next)})</span>
        </div>
        {after && (
          <div className="mt-0.5 text-xs text-indigo-700/80">
            Then {after.name} · {formatHolidayDate(after.date)} ({countdownLabel(daysBetweenDateKeys(todayKey, after.date))}
            {isNonWorkingHolidayType(after.type) ? '' : ', optional'})
          </div>
        )}
      </div>
      <Link href="/leaves/holidays" className="shrink-0 text-xs font-medium text-indigo-700 hover:text-indigo-900">
        All holidays →
      </Link>
    </div>
  )
}
