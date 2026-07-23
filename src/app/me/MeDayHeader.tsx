import { ROLE_COLORS } from '@/lib/utils'

type Props = {
  greeting: string
  firstName: string
  dateLabel: string
  role: string
  isWeekday: boolean
  hasPlan: boolean
  hasEOD: boolean
  hasCheckin: boolean
  doneTasks: number
  totalTasks: number
  totalHours: number
}

function StatusPill({
  label,
  done,
  pendingLabel,
}: {
  label: string
  done: boolean
  pendingLabel?: string
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${
        done
          ? 'bg-green-50 text-green-800 border-green-200'
          : 'bg-white text-gray-600 border-gray-200'
      }`}
    >
      <span className={done ? 'text-green-600' : 'text-gray-400'}>{done ? '✓' : '○'}</span>
      <span>{done ? label : (pendingLabel ?? label)}</span>
    </div>
  )
}

export default function MeDayHeader({
  greeting,
  firstName,
  dateLabel,
  role,
  isWeekday,
  hasPlan,
  hasEOD,
  hasCheckin,
  doneTasks,
  totalTasks,
  totalHours,
}: Props) {
  const roleCls = ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`badge ${roleCls}`}>{role}</span>
            {isWeekday && hasPlan && totalTasks > 0 && (
              <span className="text-xs text-gray-500">
                {doneTasks}/{totalTasks} tasks · {totalHours}h planned
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">
            {greeting}, {firstName}.
          </h1>
          <p className="text-sm text-gray-500 mt-1">{dateLabel}</p>
        </div>

        {isWeekday && hasPlan && !hasEOD && totalTasks > 0 && (
          <div className="sm:text-right shrink-0">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Today&apos;s progress</div>
            <div className="text-2xl font-semibold text-gray-900">{progressPct}%</div>
            <div className="mt-2 h-1.5 w-32 sm:ml-auto bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  progressPct >= 100 ? 'bg-green-500' : progressPct >= 50 ? 'bg-blue-500' : 'bg-amber-400'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {isWeekday && (
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
          <StatusPill label="Morning plan" done={hasPlan} pendingLabel="Plan pending" />
          <StatusPill label="EOD report" done={hasEOD} pendingLabel="EOD pending" />
          <StatusPill label="Weekly check-in" done={hasCheckin} pendingLabel="Check-in due" />
        </div>
      )}
    </div>
  )
}
