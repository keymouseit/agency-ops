import Link from 'next/link'
import { formatDailyLogDate, type CarryOverMovedResult } from '@/lib/daily'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  moved: {
    label: 'Moved',
    className: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  partial: {
    label: 'Partial',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
}

export default function MovedTasksCard({
  carryOver,
}: {
  carryOver: CarryOverMovedResult
}) {
  const dateLabel = formatDailyLogDate(carryOver.sourceDate)
  const hours = carryOver.tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0)
  const partialCount = carryOver.tasks.filter(t => t.status === 'partial').length
  const movedCount = carryOver.tasks.filter(t => t.status === 'moved').length

  const title = carryOver.sameDay ? 'Carried to tomorrow' : "Ready for today's plan"
  const subtitle = carryOver.sameDay
    ? "From today's EOD — these will open in tomorrow's morning plan"
    : `Left unfinished on ${dateLabel} — already lined up for today's plan`

  return (
    <section className="me-enter me-stagger-2 me-surface overflow-hidden mb-5">
      <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="me-section-title">{title}</h2>
              <span className="inline-flex items-center rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-amber-900 border border-amber-200">
                {carryOver.tasks.length} task{carryOver.tasks.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{subtitle}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px] font-medium">
              {partialCount > 0 && (
                <span className="rounded-md bg-amber-50 text-amber-800 px-2 py-0.5 border border-amber-200">
                  {partialCount} partial
                </span>
              )}
              {movedCount > 0 && (
                <span className="rounded-md bg-slate-50 text-slate-700 px-2 py-0.5 border border-slate-200">
                  {movedCount} moved
                </span>
              )}
              {hours > 0 && (
                <span className="rounded-md bg-white text-gray-600 px-2 py-0.5 border border-gray-200 tabular-nums">
                  {hours}h estimated
                </span>
              )}
            </div>
          </div>

          {!carryOver.sameDay && (
            <Link
              href="/daily/plan"
              className="inline-flex items-center justify-center self-start rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800 shrink-0 transition-colors"
            >
              Start plan
            </Link>
          )}
        </div>
      </div>

      <ul className="divide-y divide-gray-100">
        {carryOver.tasks.map(task => {
          const status = STATUS_META[task.status] ?? {
            label: task.status,
            className: 'bg-gray-50 text-gray-600 border-gray-200',
          }
          return (
            <li
              key={task.id}
              className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors"
            >
              <div
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  PRIORITY_DOT[task.priority] ?? 'bg-slate-300'
                }`}
                title={`${task.priority} priority`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 whitespace-pre-line leading-snug">
                  {task.title}
                </p>
                {task.project && (
                  <p className="mt-0.5 text-xs text-gray-500">{task.project.name}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${status.className}`}
                >
                  {status.label}
                </span>
                {task.estimatedHours != null && (
                  <span className="min-w-[2rem] text-right text-xs tabular-nums text-gray-400">
                    {task.estimatedHours}h
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {carryOver.carryOverNotes?.trim() && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            EOD note
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {carryOver.carryOverNotes}
          </p>
        </div>
      )}
    </section>
  )
}
