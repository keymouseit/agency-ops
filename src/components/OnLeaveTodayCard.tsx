import Link from 'next/link'
import type { OnLeaveTodayPerson } from '@/lib/leave-today'

function typeBadgeClass(leaveType: string) {
  if (leaveType === 'short_leave') return 'bg-sky-50 text-sky-700 ring-sky-600/15'
  if (leaveType === 'half_day') return 'bg-amber-50 text-amber-800 ring-amber-600/15'
  if (leaveType === 'birthday_leave') return 'bg-pink-50 text-pink-800 ring-pink-600/15'
  if (leaveType === 'work_from_home') return 'bg-emerald-50 text-emerald-800 ring-emerald-600/15'
  return 'bg-violet-50 text-violet-800 ring-violet-600/15'
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
    <div className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">On leave today</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {people.length}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Approved for {dateLabel ?? 'today'} · leave & work from home
          </p>
        </div>
        <Link href="/leaves" className="text-xs text-blue-600 hover:underline shrink-0">
          Leaves →
        </Link>
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-gray-500">Nobody is on approved leave today.</p>
      ) : (
        <ul className="space-y-2">
          {people.map(p => (
            <li
              key={p.leaveId}
              className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/80 px-3 py-2.5 ring-1 ring-gray-100"
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                <div className="text-[11px] text-gray-500">{p.role}</div>
              </div>
              <span
                className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ring-1 ring-inset ${typeBadgeClass(p.leaveType)}`}
              >
                {p.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
