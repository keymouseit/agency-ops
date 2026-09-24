import Link from 'next/link'
import type { OnLeaveTodayPerson } from '@/lib/leave-today'

function typeBadgeClass(leaveType: string) {
  if (leaveType === 'short_leave') return 'bg-sky-50 text-sky-700 border-sky-200'
  if (leaveType === 'half_day') return 'bg-amber-50 text-amber-800 border-amber-200'
  if (leaveType === 'birthday_leave') return 'bg-pink-50 text-pink-800 border-pink-200'
  if (leaveType === 'work_from_home') return 'bg-emerald-50 text-emerald-800 border-emerald-200'
  return 'bg-violet-50 text-violet-800 border-violet-200'
}

export default function OnLeaveTodayCard({
  people,
  dateLabel,
  className = 'mb-6',
}: {
  people: OnLeaveTodayPerson[]
  dateLabel?: string
  className?: string
}) {
  return (
    <div className={`me-surface overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="me-section-title">Today&apos;s Attendance</h2>
            <span className="inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
              {people.length}
            </span>
          </div>
          <p className="me-meta mt-0.5">
            {dateLabel ?? 'Today'} · who&apos;s on leave, short leave, or working from home
          </p>
        </div>
        <Link
          href="/leaves"
          className="text-xs font-medium text-gray-500 hover:text-gray-900 shrink-0 transition-colors"
        >
          Leaves →
        </Link>
      </div>

      <div className="p-5">
        {people.length === 0 ? (
          <p className="text-sm text-gray-500">No one is on leave or working from home today.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
            {people.map(p => (
              <li
                key={p.leaveId}
                className="flex items-center justify-between gap-3 bg-white px-3.5 py-2.5 hover:bg-gray-50/80 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                  <div className="text-[11px] text-gray-500">{p.role}</div>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium capitalize border ${typeBadgeClass(p.leaveType)}`}
                >
                  {p.label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
