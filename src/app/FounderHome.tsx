'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import type { AttentionGroup, AttentionGroupKey, AttentionRow } from '@/lib/founder-attention'
import type { OnLeaveTodayPerson } from '@/lib/leave-today'
import { OnLeaveTodayPeopleList } from '@/components/OnLeaveTodayCard'

/**
 * Founder / Manager "Needs you" home.
 * Colour rule: red = needs action, amber = due soon, everything else neutral.
 * One primary action per row.
 * Leave / WFH approvals are HR work and are not shown here — only a neutral
 * "Out today" context card (who is on leave / WFH), with no approve actions.
 */

function cardClasses(group: AttentionGroup, selected: boolean) {
  const active = group.count > 0
  const tone = !active
    ? 'border-gray-200 bg-white'
    : group.tone === 'red'
      ? 'border-red-200 bg-red-50/50'
      : 'border-amber-200 bg-amber-50/50'
  const ring = selected ? 'ring-2 ring-gray-900/80' : ''
  return `text-left rounded-xl border p-4 transition-shadow hover:shadow-sm ${tone} ${ring}`
}

function countClasses(group: AttentionGroup) {
  if (group.count === 0) return 'text-gray-400'
  return group.tone === 'red' ? 'text-red-700' : 'text-amber-700'
}

function urgencyClasses(group: AttentionGroup) {
  return group.tone === 'red' ? 'text-red-700' : 'text-amber-700'
}

const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap'

function ButtonSpinner() {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border-2 border-white/40 border-t-white animate-spin"
      aria-hidden="true"
    />
  )
}

function RowAction({ row }: { row: AttentionRow }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()
  const action = row.action

  useEffect(() => {
    if (action.kind === 'open') router.prefetch(row.href)
  }, [action.kind, router, row.href])

  async function call(url: string, init: RequestInit, success: string) {
    setBusy(true)
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      toast.success(data.alreadyNudged ? 'Already nudged in the last few hours' : success)
      setDone(true)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (action.kind === 'open') {
    const label = action.label ?? 'Open'
    return (
      <button
        type="button"
        disabled={isPending}
        className={primaryBtn}
        aria-busy={isPending}
        onMouseEnter={() => router.prefetch(row.href)}
        onFocus={() => router.prefetch(row.href)}
        onClick={() => {
          startTransition(() => {
            router.push(row.href)
          })
        }}
      >
        {isPending ? <ButtonSpinner /> : null}
        <span className="inline-block min-w-[4.5rem] text-center">{isPending ? 'Opening…' : label}</span>
      </button>
    )
  }

  if (action.kind === 'nudge') {
    return (
      <button
        type="button"
        disabled={busy || done}
        className={primaryBtn}
        title="Send the owner an in-app reminder"
        aria-busy={busy}
        onClick={() =>
          call(`/api/mom/actions/${action.actionId}/nudge`, { method: 'POST' }, 'Owner nudged')
        }
      >
        {busy ? <ButtonSpinner /> : null}
        {done ? 'Nudged' : busy ? 'Nudging…' : 'Nudge owner'}
      </button>
    )
  }

  if (action.kind === 'reopen') {
    return (
      <button
        type="button"
        disabled={busy || done}
        className={primaryBtn}
        title="Set this action back to Open"
        aria-busy={busy}
        onClick={async () => {
          const ok = await call(
            `/api/mom/${action.momId}`,
            { method: 'PATCH', body: JSON.stringify({ actionId: action.actionId, actionStatus: 'Open' }) },
            'Action reopened'
          )
          if (ok) router.refresh()
        }}
      >
        {busy ? <ButtonSpinner /> : null}
        {done ? 'Reopened' : busy ? 'Reopening…' : 'Reopen'}
      </button>
    )
  }

  // resolve_blocker — PATCH /api/blockers/[id] (Founder only; Managers get an Open row instead).
  return (
    <button
      type="button"
      disabled={busy || done}
      className={primaryBtn}
      title="Mark this escalated blocker as resolved"
      aria-busy={busy}
      onClick={async () => {
        const ok = await call(
          `/api/blockers/${action.blockerId}`,
          { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) },
          'Blocker resolved'
        )
        if (ok) router.refresh()
      }}
    >
      {busy ? <ButtonSpinner /> : null}
      {done ? 'Resolved' : busy ? 'Resolving…' : 'Resolve'}
    </button>
  )
}

function GroupList({ group }: { group: AttentionGroup }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            {group.label} <span className="text-gray-400 font-normal">· {group.count}</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{group.hint}</p>
        </div>
        <Link href={group.seeAllHref} className="text-xs text-gray-500 hover:text-gray-900 shrink-0">
          {group.seeAllLabel} →
        </Link>
      </div>
      <ul className="divide-y divide-gray-100">
        {group.rows.map(row => (
          <li key={row.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-5 py-3">
            <div className="min-w-0 flex-1">
              <Link href={row.href} className="block text-sm font-medium text-gray-900 truncate hover:underline">
                {row.title}
              </Link>
              <div className="text-xs text-gray-500 truncate">
                {row.urgency ? (
                  <span className={`font-medium ${urgencyClasses(group)}`}>{row.urgency}</span>
                ) : null}
                {row.urgency ? <span className="mx-1 text-gray-300">·</span> : null}
                {row.meta}
              </div>
              {row.chips && row.chips.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {row.chips.map(chip => (
                    <span
                      key={chip.label}
                      title={chip.title}
                      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        chip.tone === 'red'
                          ? 'bg-red-50 text-red-800 ring-1 ring-red-200'
                          : chip.tone === 'amber'
                            ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                            : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200'
                      }`}
                    >
                      {chip.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="shrink-0">
              <RowAction row={row} />
            </div>
          </li>
        ))}
      </ul>
      {group.count > group.rows.length ? (
        <div className="px-5 py-2.5 border-t border-gray-100 text-xs text-gray-500">
          Showing {group.rows.length} of {group.count}.{' '}
          <Link href={group.seeAllHref} className="underline hover:text-gray-900">
            See all
          </Link>
        </div>
      ) : null}
    </section>
  )
}

function OutTodayCard({ people }: { people: OnLeaveTodayPerson[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">
            Out today{' '}
            {people.length > 0 ? (
              <span className="text-gray-400 font-normal">· {people.length}</span>
            ) : null}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Who is on leave, short leave, or working from home
          </p>
        </div>
        <Link href="/leaves" className="text-xs text-gray-500 hover:text-gray-900 shrink-0">
          Leaves →
        </Link>
      </div>
      <div className="p-5">
        <OnLeaveTodayPeopleList
          people={people}
          emptyMessage="Everyone's in today"
        />
      </div>
    </section>
  )
}

export default function FounderHome({
  groups,
  outToday,
  initialOpen = null,
}: {
  groups: AttentionGroup[]
  outToday: OnLeaveTodayPerson[]
  /** From `/?open=<group>` (e.g. blocker notifications open "Waiting on you"). */
  initialOpen?: AttentionGroupKey | null
}) {
  const needsAction = groups.filter(g => g.tone === 'red').reduce((s, g) => s + g.count, 0)
  const firstOpen = groups.find(g => g.count > 0)?.key ?? null
  const requested = initialOpen && groups.some(g => g.key === initialOpen && g.count > 0) ? initialOpen : null
  const [openKey, setOpenKey] = useState<AttentionGroupKey | null>(requested ?? firstOpen)

  // A new `?open=` while already on Needs you (e.g. clicking a notification) re-selects that list.
  useEffect(() => {
    if (requested) setOpenKey(requested)
  }, [requested])
  // If the open list empties after a refresh (e.g. last item cleared), fall back to
  // the next card that has items. An explicit close (null) stays closed.
  const openGroup =
    openKey === null
      ? null
      : (groups.find(g => g.key === openKey && g.count > 0) ?? groups.find(g => g.count > 0) ?? null)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {groups.map(group => (
          <button
            key={group.key}
            type="button"
            className={cardClasses(group, openGroup?.key === group.key)}
            onClick={() => setOpenKey(prev => (prev === group.key ? null : group.key))}
            disabled={group.count === 0}
            aria-expanded={openGroup?.key === group.key}
          >
            <div className={`text-2xl font-bold tabular-nums ${countClasses(group)}`}>{group.count}</div>
            <div className="text-sm font-medium text-gray-900 mt-0.5">{group.label}</div>
            <div className="text-[11px] text-gray-500 mt-1">
              {group.count === 0 ? 'Nothing here' : openGroup?.key === group.key ? 'Hide list' : 'Show list'}
            </div>
          </button>
        ))}
      </div>

      {needsAction === 0 ? (
        <div className="card px-5 py-8 text-center">
          <div className="text-2xl" aria-hidden>
            ✓
          </div>
          <h2 className="text-base font-semibold text-gray-900 mt-1">All clear</h2>
          <p className="text-sm text-gray-500 mt-1">
            Nothing is waiting on you, overdue, or stuck right now.
          </p>
        </div>
      ) : null}

      {openGroup ? <GroupList group={openGroup} /> : null}

      <OutTodayCard people={outToday} />
    </div>
  )
}
