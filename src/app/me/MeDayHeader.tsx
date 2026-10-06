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
      className={`me-chip ${
        done
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
          : 'bg-white text-gray-600 border-gray-200'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
          done ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
        aria-hidden
      />
      <span>{done ? label : (pendingLabel ?? label)}</span>
    </div>
  )
}

/** Compact top strip — greeting, date, and status pills. */
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

  return (
    <header className="me-enter me-stagger-1 me-surface mb-4 sm:mb-5">
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold text-gray-950 tracking-tight leading-snug">
              {greeting}, {firstName}
            </h1>
            <span className={`badge ${roleCls} text-[10px] sm:text-xs`}>{role}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400 tabular-nums">
            <span>{dateLabel}</span>
            {isWeekday && hasPlan && totalTasks > 0 && (
              <span className="hidden sm:inline">
                · {doneTasks}/{totalTasks} · {totalHours}h
              </span>
            )}
          </div>
        </div>

        {isWeekday && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 pt-0.5 border-t border-gray-100 sm:border-0 sm:pt-0">
            <StatusPill label="Morning plan" done={hasPlan} pendingLabel="Plan pending" />
            <StatusPill label="EOD report" done={hasEOD} pendingLabel="EOD pending" />
            <StatusPill label="Weekly check-in" done={hasCheckin} pendingLabel="Check-in due" />
          </div>
        )}
      </div>
    </header>
  )
}
