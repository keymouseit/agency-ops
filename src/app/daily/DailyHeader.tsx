import Link from 'next/link'

type Props = {
  isFounder: boolean
  showTeamView: boolean
  viewMode: string
  dateParam?: string
  dateLabel: string
  isToday: boolean
  prevDate: string
  nextDate: string
  canEditPlan: boolean
  canNewPlan: boolean
  pendingEodLogId?: string
}

function dailyHref(date?: string, view?: string) {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (view) params.set('view', view)
  const q = params.toString()
  return q ? `/daily?${q}` : '/daily'
}

export default function DailyHeader({
  isFounder,
  showTeamView,
  viewMode,
  dateParam,
  dateLabel,
  isToday,
  prevDate,
  nextDate,
  canEditPlan,
  canNewPlan,
  pendingEodLogId,
}: Props) {
  const planLabel = canEditPlan ? 'Edit plan' : canNewPlan ? '+ New plan' : '+ Morning plan'
  const planHref = pendingEodLogId ? `/daily/eod?logId=${pendingEodLogId}` : '/daily/plan'
  const planButtonLabel = pendingEodLogId ? 'Submit pending EOD' : planLabel

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="badge bg-gray-100 text-gray-700">
              {isFounder ? (showTeamView ? 'Team view' : 'My log') : 'Daily log'}
            </span>
            {isToday && <span className="badge bg-blue-100 text-blue-800">Today</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
              {isFounder ? (showTeamView ? 'Daily ops' : 'My daily log') : 'My daily log'}
            </h1>
            {isFounder && (
              <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5 bg-white">
                <Link
                  href={dailyHref(dateParam, 'team')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'team'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  Team
                </Link>
                <Link
                  href={dailyHref(dateParam, 'my')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    viewMode === 'my'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  My Day
                </Link>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Link href={dailyHref(prevDate, viewMode)} className="btn-secondary text-xs px-3">
            ← Prev
          </Link>
          {!isToday && (
            <Link href={dailyHref(undefined, viewMode)} className="btn-secondary text-xs px-3">
              Today
            </Link>
          )}
          <Link href={dailyHref(nextDate, viewMode)} className="btn-secondary text-xs px-3">
            Next →
          </Link>
          {isFounder && (
            <Link href={dateParam ? `/daily/analytics?date=${dateParam}` : '/daily/analytics'} className="btn-secondary text-xs">
              Daily report
            </Link>
          )}
          {isToday && (!isFounder || pendingEodLogId) && (
            <Link href={planHref} className={pendingEodLogId ? 'btn-secondary text-xs border-red-200 text-red-700 hover:bg-red-50' : 'btn-primary text-xs'}>
              {planButtonLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
