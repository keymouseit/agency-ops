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

/** Compact top strip — greeting, date, and status pills in one slim bar. */
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
    <header className="me-enter me-stagger-1 me-surface mb-5">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-base sm:text-lg font-semibold text-gray-950 tracking-tight leading-none">
            {greeting}, {firstName}
          </h1>
          <span className="hidden sm:inline text-gray-200" aria-hidden>
            ·
          </span>
          <span className={`badge ${roleCls}`}>{role}</span>
          <span className="text-xs text-gray-400 tabular-nums">{dateLabel}</span>
          {isWeekday && hasPlan && totalTasks > 0 && (
            <span className="text-xs text-gray-400 tabular-nums">
              · {doneTasks}/{totalTasks} · {totalHours}h
            </span>
          )}
        </div>

        {isWeekday && (
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <StatusPill label="Morning plan" done={hasPlan} pendingLabel="Plan pending" />
            <StatusPill label="EOD report" done={hasEOD} pendingLabel="EOD pending" />
            <StatusPill label="Weekly check-in" done={hasCheckin} pendingLabel="Check-in due" />
          </div>
        )}
      </div>
    </header>
  )
}
