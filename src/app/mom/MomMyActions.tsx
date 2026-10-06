import Link from 'next/link'
import { differenceInDays, startOfDay } from 'date-fns'
import { fmtDate, MOM_ACTION_STATUS_COLORS, momActionStatusLabel } from '@/lib/utils'

type MyAction = {
  id: string
  title: string
  dueDate: Date
  status: string
  blockedReason: string | null
  mom: {
    id: string
    parentId: string | null
    clientName: string
    companyName: string | null
  }
}

export default function MomMyActions({ actions }: { actions: MyAction[] }) {
  if (!actions.length) return null
  const today = startOfDay(new Date())

  return (
    <section className="mb-6 rounded-2xl border border-[#e0e0e0] bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-[#e0e0e0] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">My actions</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Open / in progress / blocked items assigned to you
          </p>
        </div>
        <span className="text-xs font-medium text-gray-500">{actions.length}</span>
      </div>
      <div className="divide-y divide-[#e0e0e0]">
        {actions.map(a => {
          const rootId = a.mom.parentId ?? a.mom.id
          const days = differenceInDays(startOfDay(a.dueDate), today)
          const overdue = days < 0
          const title = a.mom.companyName
            ? `${a.mom.clientName} · ${a.mom.companyName}`
            : a.mom.clientName
          return (
            <Link
              key={a.id}
              href={`/mom/${rootId}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-3.5 hover:bg-[#f7f7f7]"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{a.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{title}</div>
                {a.status === 'Blocked' && a.blockedReason && (
                  <div className="text-xs text-red-700 mt-1 truncate">Blocked: {a.blockedReason}</div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <span className={`badge border ${MOM_ACTION_STATUS_COLORS[a.status] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                  {momActionStatusLabel(a.status)}
                </span>
                <span className={`badge border ${overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `Due ${fmtDate(a.dueDate)}`}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
