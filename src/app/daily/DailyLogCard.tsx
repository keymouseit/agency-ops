import Link from 'next/link'
import { dailyTaskTypeColor, dailyTaskTypeLabel, canEditEod } from '@/lib/daily'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-gray-300',
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-gray-100 text-gray-600',
  done: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
  moved: 'bg-gray-100 text-gray-500',
  skipped: 'bg-slate-100 text-slate-600',
}

type Task = {
  id: string
  title: string
  taskType: string
  priority: string
  status: string
  estimatedHours: number | null
  actualHours: number | null
  eodNotes: string | null
  blockedReason: string | null
  project: { name: string } | null
}

type Log = {
  id: string
  memberId: string
  eodSubmittedAt: Date | null
  planSubmittedAt: Date | null
  dayRating: number | null
  blockers: string | null
  carryOver: string | null
  eodNotes: string | null
  member: { name: string; role: string }
  tasks: Task[]
}

type Props = {
  log: Log
  isToday: boolean
  currentUserId: string
}

export default function DailyLogCard({ log, isToday, currentUserId }: Props) {
  const done = log.tasks.filter(t => t.status === 'done').length
  const total = log.tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const hasEOD = !!log.eodSubmittedAt
  const isOwn = log.memberId === currentUserId
  const initials = log.member.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-800 shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-900">{log.member.name}</h3>
                <span className="badge bg-gray-100 text-gray-600 text-[11px]">{log.member.role}</span>
              </div>
              {total > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {done}/{total} done
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {log.dayRating != null && (
              <span
                className={`badge text-xs ${
                  log.dayRating >= 4
                    ? 'bg-green-100 text-green-800'
                    : log.dayRating >= 3
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-red-100 text-red-800'
                }`}
              >
                Day {log.dayRating}/5
              </span>
            )}
            <span
              className={`badge text-xs ${
                hasEOD ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {hasEOD ? 'EOD done' : 'EOD pending'}
            </span>
            {!hasEOD ? (
              <>
                {isToday && isOwn && (
                  <Link href="/daily/plan" className="text-xs font-medium text-blue-600 hover:text-blue-800">
                    Edit plan
                  </Link>
                )}
                {(isToday || isOwn) && (
                  <Link href="/daily/eod" className="text-xs font-medium text-blue-600 hover:text-blue-800">
                    Submit EOD →
                  </Link>
                )}
              </>
            ) : (
              isToday &&
              isOwn && (
                <>
                  {canEditEod(log.eodSubmittedAt) && (
                    <Link
                      href={`/daily/eod?logId=${log.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Edit EOD
                    </Link>
                  )}
                  <Link href="/daily/plan" className="text-xs font-medium text-blue-600 hover:text-blue-800">
                    New plan
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      <div className="divide-y divide-gray-50">
        {log.tasks.map(task => (
          <div
            key={task.id}
            className={`px-5 py-3.5 flex items-start gap-3 ${
              task.status === 'done' || task.status === 'skipped' ? 'bg-gray-50/30' : ''
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-300'}`}
            />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm whitespace-pre-wrap break-words ${
                  task.status === 'done' || task.status === 'skipped'
                    ? 'line-through text-gray-400'
                    : 'text-gray-800 font-medium'
                }`}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-1.5">
                <span
                  className={`badge text-[11px] ${dailyTaskTypeColor(task.taskType)}`}
                >
                  {dailyTaskTypeLabel(task.taskType)}
                </span>
                {task.project && <span className="text-xs text-gray-400">{task.project.name}</span>}
              </div>
              {task.eodNotes && (
                <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{task.eodNotes}</p>
              )}
              {task.blockedReason && (
                <p className="text-xs text-red-600 mt-1 whitespace-pre-wrap">Blocked: {task.blockedReason}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {task.estimatedHours != null && task.estimatedHours > 0 && (
                <span className="text-xs text-gray-400 tabular-nums">
                  {task.actualHours != null ? (
                    <span
                      className={
                        task.actualHours > task.estimatedHours * 1.3 ? 'text-red-500' : 'text-gray-400'
                      }
                    >
                      {task.actualHours}h / {task.estimatedHours}h
                    </span>
                  ) : (
                    `${task.estimatedHours}h est.`
                  )}
                </span>
              )}
              <span className={`badge text-[11px] ${STATUS_COLORS[task.status] ?? 'bg-gray-100'}`}>
                {task.status}
              </span>
            </div>
          </div>
        ))}
        {log.tasks.length === 0 && (
          <div className="px-5 py-4 text-xs text-gray-400 text-center">No tasks in plan.</div>
        )}
      </div>

      {hasEOD && (log.carryOver || log.eodNotes) && (
        <footer className="px-5 py-4 bg-blue-50/80 border-t border-blue-100 text-xs space-y-3">
          {log.carryOver && (
            <div>
              <div className="font-semibold text-blue-900 mb-0.5">Carries to tomorrow</div>
              <p className="text-blue-800 whitespace-pre-wrap">{log.carryOver}</p>
            </div>
          )}
          {log.eodNotes && (
            <div>
              <div className="font-semibold text-blue-900 mb-0.5">EOD notes</div>
              <p className="text-blue-800 whitespace-pre-wrap">{log.eodNotes}</p>
            </div>
          )}
        </footer>
      )}
    </article>
  )
}
