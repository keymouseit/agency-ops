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
    className: 'bg-slate-100 text-slate-700 ring-slate-200/80',
  },
  partial: {
    label: 'Partial',
    className: 'bg-amber-50 text-amber-800 ring-amber-200/80',
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
    <section className="mb-5 overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-sm">
      <div className="relative bg-gradient-to-br from-amber-50 via-orange-50/40 to-white px-5 pt-5 pb-4">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" aria-hidden />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between pl-1">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white text-sm font-semibold shadow-sm">
                →
              </span>
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">{title}</h2>
              <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                {carryOver.tasks.length} task{carryOver.tasks.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-sm text-gray-600 max-w-xl">{subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium">
              {partialCount > 0 && (
                <span className="rounded-full bg-amber-50 text-amber-800 px-2.5 py-1 ring-1 ring-amber-200/80">
                  {partialCount} partial
                </span>
              )}
              {movedCount > 0 && (
                <span className="rounded-full bg-slate-100 text-slate-700 px-2.5 py-1 ring-1 ring-slate-200/80">
                  {movedCount} moved
                </span>
              )}
              {hours > 0 && (
                <span className="rounded-full bg-white text-gray-600 px-2.5 py-1 ring-1 ring-gray-200">
                  {hours}h estimated
                </span>
              )}
            </div>
          </div>

          {!carryOver.sameDay && (
            <Link
              href="/daily/plan"
              className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 shrink-0"
            >
              Start plan
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      <ul className="divide-y divide-gray-100 border-t border-amber-100/80">
        {carryOver.tasks.map(task => {
          const status = STATUS_META[task.status] ?? {
            label: task.status,
            className: 'bg-gray-100 text-gray-600 ring-gray-200',
          }
          return (
            <li
              key={task.id}
              className="flex items-start gap-3 px-5 py-3.5 hover:bg-amber-50/30 transition-colors"
            >
              <div
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
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
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${status.className}`}
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
        <div className="border-t border-amber-100/80 bg-amber-50/40 px-5 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800/80 mb-1">
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
