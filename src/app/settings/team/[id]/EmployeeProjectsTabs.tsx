'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { fmtDate, PROJECT_STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'

export type EmployeeProjectRow = {
  id: string
  name: string
  status: string
  clientName: string | null
  /** ISO string or null — Project.actualEnd (set when status → delivered) */
  actualEnd: string | null
  /** ISO string or null — fallback when actualEnd is missing */
  estimatedEnd: string | null
  roles: string[]
}

type TabKey = 'in_progress' | 'completed' | 'delivered'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'delivered', label: 'Delivered' },
]

/** Active pipeline + paused work. */
const IN_PROGRESS_STATUSES = new Set(['scoping', 'active', 'qa', 'on_hold'])
/** Closed / post-build (no dedicated "completed" status in schema). */
const COMPLETED_STATUSES = new Set(['maintenance', 'cancelled'])
const DELIVERED_STATUSES = new Set(['delivered'])

function tabForStatus(status: string): TabKey {
  if (DELIVERED_STATUSES.has(status)) return 'delivered'
  if (COMPLETED_STATUSES.has(status)) return 'completed'
  if (IN_PROGRESS_STATUSES.has(status)) return 'in_progress'
  // Unknown statuses land in In Progress so they stay visible
  return 'in_progress'
}

function deliveredDateLabel(p: EmployeeProjectRow): string {
  const raw = p.actualEnd || p.estimatedEnd
  if (!raw) return '—'
  return fmtDate(raw)
}

const EMPTY_COPY: Record<TabKey, { title: string; hint: string }> = {
  in_progress: {
    title: 'No in-progress projects',
    hint: 'Scoping, active, QA, and on-hold work will show up here',
  },
  completed: {
    title: 'No completed projects',
    hint: 'Maintenance and cancelled projects will show up here',
  },
  delivered: {
    title: 'No delivered projects',
    hint: 'Delivered projects and their delivery date will show up here',
  },
}

export default function EmployeeProjectsTabs({
  projects,
}: {
  projects: EmployeeProjectRow[]
}) {
  const [tab, setTab] = useState<TabKey>('in_progress')

  const grouped = useMemo(() => {
    const buckets: Record<TabKey, EmployeeProjectRow[]> = {
      in_progress: [],
      completed: [],
      delivered: [],
    }
    for (const p of projects) {
      buckets[tabForStatus(p.status)].push(p)
    }
    return buckets
  }, [projects])

  const rows = grouped[tab]
  const showDeliveredDate = tab === 'delivered'
  const empty = EMPTY_COPY[tab]

  if (projects.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm font-medium text-gray-500">No linked projects</p>
        <p className="text-xs text-gray-400 mt-1">
          Assign this member on a project to see them here
        </p>
      </div>
    )
  }

  return (
    <div>
      <div
        className="flex flex-wrap gap-1 border-b border-gray-100 px-4 sm:px-5"
        role="tablist"
        aria-label="Project status"
      >
        {TABS.map(t => {
          const count = grouped[t.key].length
          const on = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.key)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                on
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {t.label}
              <span
                className={`ml-2 text-xs tabular-nums ${on ? 'text-gray-700' : 'text-gray-400'}`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-medium text-gray-500">{empty.title}</p>
          <p className="text-xs text-gray-400 mt-1">{empty.hint}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-slate-50/80">
                <th className="px-4 sm:px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Project
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">
                  Client
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Role
                </th>
                <th className="px-4 sm:px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400 text-right">
                  {showDeliveredDate ? 'Delivered' : 'Status'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(p => {
                const statusCls = STATUS_COLORS[p.status] ?? 'bg-gray-100 text-gray-700'
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 sm:px-5 py-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="text-sm font-semibold text-gray-900 hover:text-blue-600"
                      >
                        {p.name}
                      </Link>
                      {p.clientName && (
                        <p className="text-xs text-gray-400 mt-0.5 sm:hidden">{p.clientName}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500 hidden sm:table-cell">
                      {p.clientName || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.roles.map(r => (
                          <span
                            key={r}
                            className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right">
                      {showDeliveredDate ? (
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {deliveredDateLabel(p)}
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${statusCls}`}
                        >
                          {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
