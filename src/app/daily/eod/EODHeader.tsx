import Link from 'next/link'
import { ROLE_COLORS } from '@/lib/utils'
import { formatIst, formatIstWeekdayCompact } from '@/lib/ist'

type Props = {
  memberName: string
  memberRole: string
  date: string | Date
  isEditMode: boolean
  readOnly?: boolean
  eodSubmittedAt?: Date | string | null
}

export default function EODHeader({
  memberName,
  memberRole,
  date,
  isEditMode,
  readOnly = false,
  eodSubmittedAt,
}: Props) {
  const roleCls = ROLE_COLORS[memberRole] ?? 'bg-gray-100 text-gray-700'
  const dateLabel = formatIstWeekdayCompact(date)

  const title = readOnly ? 'EOD report' : isEditMode ? 'Edit EOD report' : 'EOD report'
  const subtitle = readOnly
    ? eodSubmittedAt
      ? `Submitted ${formatIst(eodSubmittedAt, { day: 'numeric', month: 'short' })} · Read-only`
      : 'Read-only'
    : isEditMode
      ? 'Editable until end of today'
      : 'Due by 7pm'

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-indigo-50/30 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-base text-white shrink-0">
            🌙
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h1>
              <span className={`badge text-[10px] px-2 py-0 ${roleCls}`}>{memberRole}</span>
              {readOnly ? (
                <span className="badge text-[10px] px-2 py-0 bg-gray-100 text-gray-700">Read-only</span>
              ) : isEditMode ? (
                <span className="badge text-[10px] px-2 py-0 bg-blue-100 text-blue-800">Editing</span>
              ) : (
                <span className="badge text-[10px] px-2 py-0 bg-indigo-100 text-indigo-800">Due 7pm</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {dateLabel} · {subtitle} · {memberName}
            </p>
          </div>
        </div>
        <Link href="/daily" className="btn-secondary text-[11px] px-2.5 py-1.5 shrink-0">
          ← Daily
        </Link>
      </div>
    </div>
  )
}
