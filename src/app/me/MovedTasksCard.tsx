import Link from 'next/link'
import { formatDailyLogDate, type CarryOverMovedResult } from '@/lib/daily'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-gray-300',
}

export default function MovedTasksCard({
  carryOver,
}: {
  carryOver: CarryOverMovedResult
}) {
  const dateLabel = formatDailyLogDate(carryOver.sourceDate)
  const title = carryOver.sameDay ? 'Moved to tomorrow' : 'Your moved tasks'
  const subtitle = carryOver.sameDay
    ? `From today's EOD · will prefill tomorrow's plan`
    : `From ${dateLabel}'s EOD · prefilled when you plan today`

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-gray-50 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white text-lg shrink-0">
            →
          </span>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {carryOver.tasks.length}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {!carryOver.sameDay && (
          <Link
            href="/daily/plan"
            className="inline-flex items-center justify-center px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-colors shrink-0"
          >
            Plan with these →
          </Link>
        )}
      </div>

      <ul className="rounded-lg border border-gray-100 bg-white divide-y divide-gray-50 overflow-hidden">
        {carryOver.tasks.map(task => (
          <li key={task.id} className="flex items-start gap-3 px-3 py-2.5">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                PRIORITY_DOT[task.priority] ?? 'bg-gray-300'
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 whitespace-pre-line">{task.title}</div>
              {task.project && (
                <div className="text-xs text-gray-400 mt-0.5">{task.project.name}</div>
              )}
            </div>
            {task.estimatedHours != null && (
              <span className="text-xs text-gray-400 tabular-nums shrink-0">{task.estimatedHours}h</span>
            )}
          </li>
        ))}
      </ul>

      {carryOver.carryOverNotes?.trim() && (
        <p className="mt-3 text-xs text-gray-600 bg-white/70 border border-gray-100 rounded-lg px-3 py-2">
          <span className="font-medium text-gray-700">Note:</span> {carryOver.carryOverNotes}
        </p>
      )}
    </div>
  )
}
