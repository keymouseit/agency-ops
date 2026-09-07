import Link from 'next/link'
import { format } from 'date-fns'
import { ROLE_COLORS } from '@/lib/utils'

type Props = {
  memberName: string
  memberRole: string
  isEdit: boolean
  replanAfterEod: boolean
}

export default function MorningPlanHeader({
  memberName,
  memberRole,
  isEdit,
  replanAfterEod,
}: Props) {
  const roleCls = ROLE_COLORS[memberRole] ?? 'bg-gray-100 text-gray-700'
  const title = isEdit
    ? "Edit today's plan"
    : replanAfterEod
      ? 'New plan for today'
      : 'Morning plan'

  const subtitle = isEdit
    ? 'Update before EOD'
    : replanAfterEod
      ? 'Fresh plan after EOD'
      : 'Due by 9:30am'

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-amber-50/30 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-base text-white shrink-0">
            ☀️
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">{title}</h1>
              <span className={`badge text-[10px] px-2 py-0 ${roleCls}`}>{memberRole}</span>
              {!isEdit && !replanAfterEod && (
                <span className="badge text-[10px] px-2 py-0 bg-amber-100 text-amber-800">Due 9:30am</span>
              )}
              {isEdit && <span className="badge text-[10px] px-2 py-0 bg-blue-100 text-blue-800">Editing</span>}
              {replanAfterEod && (
                <span className="badge text-[10px] px-2 py-0 bg-purple-100 text-purple-800">Re-plan</span>
              )}
            </div>
            <p className="text-xs text-gray-500">
              {format(new Date(), 'EEE, d MMM yyyy')} · {subtitle} · {memberName}
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
