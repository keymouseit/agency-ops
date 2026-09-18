'use client'

import { fmtDate } from '@/lib/utils'

export type WorkMemo = {
  id: string
  date: string
  title: string
  memberName: string
  estimatedHours: number | null
  actualHours: number | null
  status: string
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

function HoursBadge({
  actualHours,
  estimatedHours,
}: {
  actualHours: number | null
  estimatedHours: number | null
}) {
  if (actualHours != null) {
    return (
      <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
        {actualHours}h logged
      </span>
    )
  }
  if (estimatedHours != null) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/15">
        {estimatedHours}h planned
      </span>
    )
  }
  return null
}

export default function ProjectWorkMemos({ memos }: { memos: WorkMemo[] }) {
  const loggedTotal = memos.reduce((sum, m) => sum + (m.actualHours ?? 0), 0)
  const plannedOnly = memos
    .filter(m => m.actualHours == null)
    .reduce((sum, m) => sum + (m.estimatedHours ?? 0), 0)

  return (
    <div className="card overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Work memos</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              From morning plans linked to this project
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
            {memos.length} {memos.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {memos.length > 0 && (loggedTotal > 0 || plannedOnly > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {loggedTotal > 0 && (
              <span className="text-[11px] text-gray-600">
                <span className="font-semibold text-gray-900">{loggedTotal}h</span> logged
              </span>
            )}
            {loggedTotal > 0 && plannedOnly > 0 && (
              <span className="text-gray-300">·</span>
            )}
            {plannedOnly > 0 && (
              <span className="text-[11px] text-gray-600">
                <span className="font-semibold text-gray-900">{plannedOnly}h</span> still planned
              </span>
            )}
          </div>
        )}
      </div>

      {memos.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-600 font-medium">No work memos yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[16rem] mx-auto">
            When someone picks this project in their morning plan, the task memo and hours show here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50 max-h-[22rem] overflow-y-auto">
          {memos.map(memo => (
            <li key={memo.id} className="px-4 py-3.5 hover:bg-gray-50/70 transition-colors">
              <div className="flex gap-3">
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white"
                  title={memo.memberName}
                >
                  {initials(memo.memberName) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[11px] text-gray-500 leading-5">
                      <span className="font-semibold text-gray-700">{fmtDate(memo.date)}</span>
                      <span className="text-gray-300"> · </span>
                      <span>{memo.memberName}</span>
                    </p>
                    <HoursBadge
                      actualHours={memo.actualHours}
                      estimatedHours={memo.estimatedHours}
                    />
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {memo.title}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
