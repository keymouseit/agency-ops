'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { differenceInDays, formatDistanceToNow, startOfDay } from 'date-fns'
import {
  fmtDate,
  isMomActionClosed,
  isMomActionOpenish,
  MOM_FINAL_STATUSES,
  MOM_FINAL_STATUS_COLORS,
  MOM_MEETING_TYPE_COLORS,
  normalizeMomFinalStatus,
  type MomFinalStatus,
} from '@/lib/utils'
import {
  filterMomsByQuery,
  followUpStatusLabel,
  isFollowUpPending,
  type MomSearchable,
} from '@/lib/mom'

type ActionSummary = {
  id: string
  title: string
  dueDate: string | Date
  status: string
  ownerId: string
}

type MomRecord = MomSearchable & {
  meetingDate: string | Date
  followUpDate: string | Date | null
  followUpCompletedAt?: string | Date | null
  followUpCount?: number
  finalStatus?: string | null
  meetingTime?: string | null
  actionItems?: ActionSummary[]
  threadActionItems?: ActionSummary[]
}

type NormalizedMom = ReturnType<typeof normalizeRecord>
type StatusFilter = 'all' | MomFinalStatus
type ExtraFilter = 'all' | 'my_actions' | 'overdue' | 'due_soon' | 'blocked'

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

function normalizeRecord(record: MomRecord) {
  const actions = (record.threadActionItems ?? record.actionItems ?? []).map(a => ({
    ...a,
    dueDate: toDate(a.dueDate)!,
  }))
  return {
    ...record,
    meetingDate: toDate(record.meetingDate)!,
    followUpDate: toDate(record.followUpDate),
    followUpCompletedAt: toDate(record.followUpCompletedAt),
    finalStatus: normalizeMomFinalStatus(record.finalStatus),
    actions,
  }
}

function isActionOpen(status: string) {
  return isMomActionOpenish(status)
}

function isActionOverdue(action: { dueDate: Date; status: string }, today: Date) {
  if (isMomActionClosed(action.status)) return false
  return differenceInDays(startOfDay(action.dueDate), today) < 0
}

function MomListRow({ record, today }: { record: NormalizedMom; today: Date }) {
  const title = record.companyName
    ? `${record.clientName} · ${record.companyName}`
    : record.clientName

  const overdueActions = record.actions.filter(a => isActionOverdue(a, today))
  const blockedActions = record.actions.filter(a => a.status === 'Blocked')
  const nextCallBadge = isFollowUpPending(record)
    ? followUpStatusLabel(record, today)
    : null
  const followUpOverdue =
    isFollowUpPending(record) &&
    differenceInDays(startOfDay(record.followUpDate!), today) < 0
  const needsAttention = overdueActions.length > 0 || followUpOverdue || blockedActions.length > 0
  const showBadges = needsAttention || !!nextCallBadge

  return (
    <Link
      href={`/mom/${record.id}`}
      className="grid grid-cols-1 sm:grid-cols-[minmax(140px,18%)_minmax(0,1fr)_minmax(200px,28%)] gap-2 sm:gap-6 px-6 py-5 hover:bg-[#f7f7f7] transition-colors items-center"
    >
      <div className="text-sm text-[#5e6d55]">
        <div>{fmtDate(record.meetingDate)}</div>
        <div className="mt-0.5">
          {formatDistanceToNow(record.meetingDate, { addSuffix: true })}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[15px] text-[#1f57c3] underline leading-snug">
          {title}
        </div>
        {showBadges && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {blockedActions.length > 0 && (
              <span className="badge border bg-red-600 text-white border-red-700">
                {blockedActions.length} blocked
              </span>
            )}
            {overdueActions.length > 0 && (
              <span className="badge border bg-red-50 text-red-700 border-red-200">
                {overdueActions.length} overdue action{overdueActions.length === 1 ? '' : 's'}
              </span>
            )}
            {nextCallBadge && (
              <span className={`badge border ${nextCallBadge.cls}`}>
                {nextCallBadge.text}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
        <span className={`badge ${MOM_MEETING_TYPE_COLORS[record.meetingType] ?? 'bg-gray-100 text-gray-700'}`}>
          {record.meetingType}
        </span>
        <span className={`badge border ${MOM_FINAL_STATUS_COLORS[record.finalStatus] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
          {record.finalStatus}
        </span>
        {record.leadSource ? (
          <span className="badge bg-sky-50 text-sky-800">{record.leadSource}</span>
        ) : null}
        <span className="badge bg-gray-100 text-gray-700">
          {record.createdBy.name}
        </span>
      </div>
    </Link>
  )
}

function StatusCard({
  title,
  records,
  today,
}: {
  title: string
  records: NormalizedMom[]
  today: Date
}) {
  return (
    <section className="rounded-2xl border border-[#e0e0e0] bg-white overflow-hidden">
      <div className="px-6 py-5">
        <h2 className="text-xl font-semibold text-[#001e00]">
          {title} ({records.length})
        </h2>
      </div>
      {records.length > 0 ? (
        <div className="divide-y divide-[#e0e0e0] border-t border-[#e0e0e0]">
          {records.map(record => (
            <MomListRow key={record.id} record={record} today={today} />
          ))}
        </div>
      ) : (
        <div className="border-t border-[#e0e0e0] px-6 py-8 text-sm text-[#5e6d55]">
          No clients with this status.
        </div>
      )}
    </section>
  )
}

function parseExtraFilter(value?: string | null): ExtraFilter {
  if (value === 'my_actions' || value === 'overdue' || value === 'due_soon' || value === 'blocked') return value
  return 'all'
}

export default function MomListPanel({
  records,
  currentMemberId,
  hideImmediateBanner = false,
}: {
  records: MomRecord[]
  currentMemberId?: string | null
  /** When Founder/Manager attention board already shows overdue/blocked, skip the redundant banner. */
  hideImmediateBanner?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  // URL is source of truth — Links (See all blocked) and chips share the same ?filter= param.
  const extraFilter = parseExtraFilter(searchParams.get('filter'))
  const setExtraFilter = (next: ExtraFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'all') params.delete('filter')
    else params.set('filter', next)
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }
  const today = useMemo(() => startOfDay(new Date()), [])

  const normalized = useMemo(
    () => records.map(normalizeRecord),
    [records],
  )

  const immediateCount = useMemo(() => {
    let n = 0
    for (const r of normalized) {
      n += r.actions.filter(a => isActionOpen(a.status) && isActionOverdue(a, today)).length
      // Blocked counts even when not overdue — founder must not miss them
      n += r.actions.filter(a => a.status === 'Blocked' && !isActionOverdue(a, today)).length
      if (
        isFollowUpPending(r) &&
        differenceInDays(startOfDay(r.followUpDate!), today) < 0
      ) {
        n += 1
      }
    }
    return n
  }, [normalized, today])

  const searched = useMemo(
    () => filterMomsByQuery(normalized, query),
    [normalized, query],
  )

  const afterExtra = useMemo(() => {
    if (extraFilter === 'all') return searched
    if (extraFilter === 'my_actions') {
      if (!currentMemberId) return []
      return searched.filter(r =>
        r.actions.some(a => a.ownerId === currentMemberId && isActionOpen(a.status))
      )
    }
    if (extraFilter === 'due_soon') {
      return searched.filter(r => {
        const actionSoon = r.actions.some(a => {
          if (!isActionOpen(a.status)) return false
          const d = differenceInDays(startOfDay(a.dueDate), today)
          return d >= 0 && d <= 7
        })
        const fuSoon =
          isFollowUpPending(r) &&
          (() => {
            const d = differenceInDays(startOfDay(r.followUpDate!), today)
            return d >= 0 && d <= 7
          })()
        return actionSoon || fuSoon
      })
    }
    if (extraFilter === 'blocked') {
      return searched.filter(r => r.actions.some(a => a.status === 'Blocked'))
    }
    if (extraFilter === 'overdue') {
      return searched.filter(r => {
        const actionOd = r.actions.some(a => isActionOverdue(a, today))
        const fuOd =
          isFollowUpPending(r) &&
          differenceInDays(startOfDay(r.followUpDate!), today) < 0
        return actionOd || fuOd
      })
    }
    return searched
  }, [searched, extraFilter, currentMemberId, today])

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(MOM_FINAL_STATUSES.map(s => [s, 0])) as Record<MomFinalStatus, number>
    for (const record of afterExtra) {
      counts[record.finalStatus] += 1
    }
    return counts
  }, [afterExtra])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return afterExtra
    return afterExtra.filter(r => r.finalStatus === statusFilter)
  }, [afterExtra, statusFilter])

  const grouped = useMemo(() => {
    const next = Object.fromEntries(MOM_FINAL_STATUSES.map(s => [s, [] as NormalizedMom[]])) as Record<
      MomFinalStatus,
      NormalizedMom[]
    >
    for (const record of filtered) {
      next[record.finalStatus].push(record)
    }
    return next
  }, [filtered])

  const visibleStatuses = statusFilter === 'all' ? [...MOM_FINAL_STATUSES] : [statusFilter]
  const trimmedQuery = query.trim()
  const myActionsCount = currentMemberId
    ? searched.filter(r =>
        r.actions.some(a => a.ownerId === currentMemberId && isActionOpen(a.status))
      ).length
    : 0
  const overdueCount = searched.filter(r => {
    const actionOd = r.actions.some(a => isActionOverdue(a, today))
    const fuOd =
      isFollowUpPending(r) &&
      differenceInDays(startOfDay(r.followUpDate!), today) < 0
    return actionOd || fuOd
  }).length
  const dueSoonCount = searched.filter(r => {
    const actionSoon = r.actions.some(a => {
      if (!isActionOpen(a.status)) return false
      const d = differenceInDays(startOfDay(a.dueDate), today)
      return d >= 0 && d <= 7
    })
    const fuSoon =
      isFollowUpPending(r) &&
      (() => {
        const d = differenceInDays(startOfDay(r.followUpDate!), today)
        return d >= 0 && d <= 7
      })()
    return actionSoon || fuSoon
  }).length
  const blockedCount = searched.filter(r =>
    r.actions.some(a => a.status === 'Blocked')
  ).length

  return (
    <div>
      {!hideImmediateBanner && immediateCount > 0 && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-red-800">
            Immediate action needed ({immediateCount})
          </span>
          <div className="flex flex-wrap gap-3 shrink-0">
            {blockedCount > 0 && (
              <button
                type="button"
                onClick={() => setExtraFilter('blocked')}
                className="text-xs font-medium text-red-800 underline"
              >
                Show blocked
              </button>
            )}
            <button
              type="button"
              onClick={() => setExtraFilter('overdue')}
              className="text-xs font-medium text-red-800 underline"
            >
              Show overdue
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="relative w-full sm:max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400" aria-hidden>
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
          </div>
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by client name, company, email…"
            className={`input !pl-10 py-2 text-sm bg-white${trimmedQuery ? ' !pr-16' : ''}`}
            aria-label="Search meeting minutes"
          />
          {trimmedQuery ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="mom-status-filter" className="text-xs font-medium text-gray-500 shrink-0">
            Status
          </label>
          <select
            id="mom-status-filter"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="input py-2 text-sm bg-white w-full sm:min-w-[16rem]"
            aria-label="Filter clients by status"
          >
            <option value="all">All statuses ({afterExtra.length})</option>
            {MOM_FINAL_STATUSES.map(status => (
              <option key={status} value={status}>
                {status} ({statusCounts[status]})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {([
          ['all', `All (${searched.length})`],
          ['my_actions', `My actions (${myActionsCount})`],
          ['overdue', `Overdue (${overdueCount})`],
          ['blocked', `Blocked (${blockedCount})`],
          ['due_soon', `Due soon (${dueSoonCount})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setExtraFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              extraFilter === key
                ? key === 'overdue' || key === 'blocked'
                  ? 'bg-red-600 text-white border-red-600'
                  : key === 'due_soon'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
            statusFilter === 'all'
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          All ({afterExtra.length})
        </button>
        {MOM_FINAL_STATUSES.map(status => {
          const active = statusFilter === status
          const tone = MOM_FINAL_STATUS_COLORS[status] ?? 'bg-gray-50 text-gray-700 border-gray-200'
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                active ? tone : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {status} ({statusCounts[status]})
            </button>
          )
        })}
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-[#e0e0e0] bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#001e00]">No meeting minutes yet</p>
          <p className="text-sm text-[#5e6d55] mt-1 max-w-sm mx-auto">
            Log your first client call with outcomes, attendees, and follow-up actions.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#e0e0e0] bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#001e00]">No clients match this filter</p>
          <p className="text-sm text-[#5e6d55] mt-1">
            Try another status or clear the search.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all')
              setExtraFilter('all')
              setQuery('')
            }}
            className="mt-3 text-xs font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleStatuses.map(status => (
            <StatusCard key={status} title={status} records={grouped[status]} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}
