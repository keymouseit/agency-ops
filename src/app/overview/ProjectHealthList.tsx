'use client'

import Link from 'next/link'
import { useState } from 'react'
import ClickableRow from '@/components/ClickableRow'
import ShowMoreRows from '@/components/ShowMoreRows'
import type { HealthLabel } from '@/lib/project-health'

/** One active project, pre-computed on the server (SummaryTab). */
export type ProjectHealthRow = {
  id: string
  name: string
  owner: string
  score: number
  label: HealthLabel
  /** Days to estimated end (negative = overdue), null when there is no end date. */
  daysLeft: number | null
  /** Latest check-in's onTrack answer ('yes' | 'no' | 'at_risk'), if any. */
  onTrack: string | null
  burn: number | null
  estimatedHours: number | null
  actualHours: number | null
  projectedHours: number | null
  milestonesDone: number
  milestonesTotal: number
  daysSinceClientUpdate: number | null
  overBudget: boolean
  unsignedCOs: number
  contractValueLabel: string | null
  timeByType: string | null
  blocker: string | null
}

export type HealthFilter = 'all' | 'at-risk' | 'attention' | 'healthy'

const VISIBLE_PROJECTS = 8
const COLS = 7

const FILTER_LABEL: Record<Exclude<HealthFilter, 'all'>, HealthLabel> = {
  'at-risk': 'critical',
  attention: 'at_risk',
  healthy: 'healthy',
}

/** Founder-facing wording: critical → "At risk", at_risk → "Needs attention". */
const STATUS: Record<HealthLabel, { text: string; chip: string; dot: string; pill: string }> = {
  critical: {
    text: 'At risk',
    chip: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-100',
    dot: 'bg-red-500',
    pill: 'bg-red-50 text-red-700 ring-red-200',
  },
  at_risk: {
    text: 'Needs attention',
    chip: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100',
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
  },
  healthy: {
    text: 'Healthy',
    chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
}

function MiniBar({ pct, tone }: { pct: number; tone: 'neutral' | 'amber' | 'red' | 'green' }) {
  const bar =
    tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-400' : tone === 'green' ? 'bg-emerald-500' : 'bg-gray-400'
  return (
    <div className="h-1.5 flex-1 min-w-0 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
    </div>
  )
}

function timeline(r: ProjectHealthRow): { dot: string; text: string; sub: string | null; title: string } {
  if (r.daysLeft == null) return { dot: 'bg-gray-300', text: 'No end date', sub: null, title: 'No estimated end date set' }
  if (r.daysLeft < 0) {
    const d = Math.abs(r.daysLeft)
    return { dot: 'bg-red-500', text: `${d}d overdue`, sub: null, title: `Estimated end was ${d} day${d === 1 ? '' : 's'} ago` }
  }
  const left = `${r.daysLeft}d left`
  if (r.onTrack === 'no' || r.onTrack === 'at_risk') {
    return {
      dot: 'bg-amber-500',
      text: r.onTrack === 'no' ? 'Behind plan' : 'At risk',
      sub: left,
      title: `Latest check-in says ${r.onTrack === 'no' ? 'not on track' : 'at risk'} · ${left}`,
    }
  }
  if (r.daysLeft <= 7) {
    return { dot: 'bg-amber-500', text: r.daysLeft === 0 ? 'Due today' : `Due in ${r.daysLeft}d`, sub: null, title: left }
  }
  return { dot: 'bg-emerald-500', text: 'On track', sub: left, title: left }
}

function clientUpdateText(d: number | null) {
  if (d == null) return 'No update logged'
  if (d < 7) return 'This week'
  return `${d}d ago`
}

function MobileLabel({ children }: { children: string }) {
  return <span className="md:hidden block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{children}</span>
}

function Row({ r }: { r: ProjectHealthRow }) {
  const href = `/projects/${r.id}`
  const s = STATUS[r.label]
  const t = timeline(r)
  const burnTone = r.burn == null ? 'neutral' : r.burn > 100 ? 'red' : r.burn > 90 ? 'amber' : 'neutral'
  const msPct = r.milestonesTotal ? (r.milestonesDone / r.milestonesTotal) * 100 : 0
  const projectedOver = r.projectedHours && r.estimatedHours && r.projectedHours > r.estimatedHours
  const tooltip = [r.contractValueLabel ? `Value: ${r.contractValueLabel}` : null, r.timeByType ? `Last 30d: ${r.timeByType}` : null]
    .filter(Boolean)
    .join('\n')
  const clientUpdate = clientUpdateText(r.daysSinceClientUpdate)

  return (
    <ClickableRow href={href} className="group hover:bg-gray-50/80 block w-full md:table-row">
      {/* Mobile card (single cell) — full name, no side-by-side squeeze */}
      <td className="md:hidden block w-full px-4 py-3.5 align-top" colSpan={COLS}>
        <div className="space-y-2.5 w-full min-w-0">
          <div className="flex items-start gap-2.5 min-w-0">
            <span
              className={`inline-flex h-7 min-w-[2.25rem] shrink-0 items-center justify-center rounded-lg px-1.5 text-sm font-semibold tabular-nums ring-1 ring-inset ${s.pill}`}
              title={`Health score ${r.score} / 10`}
            >
              {r.score}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5">
                <Link href={href} className="text-sm font-semibold text-gray-900 hover:underline break-words">
                  {r.name}
                </Link>
                {r.blocker ? (
                  <span
                    className="shrink-0 text-xs text-amber-600 cursor-help mt-0.5"
                    title={`Blocker: ${r.blocker}`}
                    aria-label="Has a blocker"
                  >
                    ⚠
                  </span>
                ) : null}
                <span
                  className="hidden group-data-[pending=true]:inline-block h-3 w-3 shrink-0 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin mt-0.5"
                  aria-hidden="true"
                />
              </div>
              <p className="text-xs text-gray-500 mt-0.5 break-words">
                {r.owner}
                <span className="mx-1 text-gray-300">·</span>
                <span className="text-gray-400">
                  {r.daysSinceClientUpdate == null
                    ? 'No client update logged'
                    : `Client update ${clientUpdate.toLowerCase()}`}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`badge text-[11px] px-2 whitespace-nowrap ${s.chip}`}>{s.text}</span>
            {r.overBudget && (
              <span className="badge text-[11px] px-2 whitespace-nowrap bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
                Over budget
              </span>
            )}
            {r.unsignedCOs > 0 && (
              <span className="badge text-[11px] px-2 whitespace-nowrap bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
                {r.unsignedCOs} CO unsigned
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 w-full">
            <div className="min-w-0" title={t.title}>
              <MobileLabel>Timeline</MobileLabel>
              <div className="flex items-center gap-1.5 text-xs min-w-0">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
                <span className="text-gray-700 truncate">{t.text}</span>
              </div>
              {t.sub ? <div className="text-[11px] text-gray-400 pl-3 truncate">{t.sub}</div> : null}
            </div>
            <div
              className="min-w-0"
              title={
                r.estimatedHours
                  ? `${Math.round(r.actualHours ?? 0)}h of ${Math.round(r.estimatedHours)}h estimated${
                      projectedOver ? ` · projected ${r.projectedHours}h` : ''
                    }`
                  : 'No hour estimate'
              }
            >
              <MobileLabel>Hours</MobileLabel>
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <span
                  className={`text-xs tabular-nums shrink-0 ${
                    burnTone === 'red'
                      ? 'text-red-700 font-medium'
                      : burnTone === 'amber'
                        ? 'text-amber-700'
                        : r.burn == null
                          ? 'text-gray-300'
                          : 'text-gray-700'
                  }`}
                >
                  {r.burn != null ? `${r.burn}%` : '—'}
                </span>
                {r.burn != null ? <MiniBar pct={r.burn} tone={burnTone} /> : null}
              </div>
            </div>
            <div className="min-w-0">
              <MobileLabel>Milestones</MobileLabel>
              <div className="flex items-center gap-1.5 min-w-0 w-full">
                <span className={`text-xs tabular-nums shrink-0 ${r.milestonesTotal ? 'text-gray-700' : 'text-gray-300'}`}>
                  {r.milestonesTotal ? `${r.milestonesDone}/${r.milestonesTotal}` : '—'}
                </span>
                {r.milestonesTotal ? (
                  <MiniBar pct={msPct} tone={r.milestonesDone === r.milestonesTotal ? 'green' : 'neutral'} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </td>

      {/* Desktop table cells */}
      <td className="hidden md:table-cell md:w-14 md:pl-5 md:pr-2 md:py-2.5 align-middle">
        <span
          className={`inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-lg px-1.5 text-sm font-semibold tabular-nums ring-1 ring-inset ${s.pill}`}
          title={`Health score ${r.score} / 10`}
        >
          {r.score}
        </span>
      </td>

      <td className="hidden md:table-cell md:w-full md:max-w-0 md:px-3 md:py-2.5 align-middle" title={tooltip || undefined}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Link href={href} className="text-sm font-medium text-gray-900 hover:underline truncate">
            {r.name}
          </Link>
          {r.blocker ? (
            <span className="shrink-0 text-xs text-amber-600 cursor-help" title={`Blocker: ${r.blocker}`} aria-label="Has a blocker">
              ⚠
            </span>
          ) : null}
          <span
            className="hidden group-data-[pending=true]:inline-block h-3 w-3 shrink-0 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin"
            aria-hidden="true"
          />
        </div>
        <div className="text-xs text-gray-500 truncate">{r.owner}</div>
      </td>

      <td className="hidden md:table-cell md:px-3 md:py-2.5 align-middle">
        <div className="flex flex-wrap items-center gap-1">
          <span className={`badge text-[11px] px-2 whitespace-nowrap ${s.chip}`}>{s.text}</span>
          {r.overBudget && (
            <span className="badge text-[11px] px-2 whitespace-nowrap bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
              Over budget
            </span>
          )}
          {r.unsignedCOs > 0 && (
            <span className="badge text-[11px] px-2 whitespace-nowrap bg-red-50 text-red-700 ring-1 ring-inset ring-red-100">
              {r.unsignedCOs} CO unsigned
            </span>
          )}
        </div>
      </td>

      <td className="hidden md:table-cell md:px-3 md:py-2.5 align-middle" title={t.title}>
        <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.dot}`} />
          <span className="text-gray-700">{t.text}</span>
        </div>
        {t.sub ? <div className="text-[11px] text-gray-400 pl-3 whitespace-nowrap">{t.sub}</div> : null}
      </td>

      <td
        className="hidden md:table-cell md:px-3 md:py-2.5 align-middle"
        title={
          r.estimatedHours
            ? `${Math.round(r.actualHours ?? 0)}h of ${Math.round(r.estimatedHours)}h estimated${
                projectedOver ? ` · projected ${r.projectedHours}h` : ''
              }`
            : 'No hour estimate'
        }
      >
        <div className="flex items-center gap-2 min-w-0 w-full max-w-[9rem]">
          <span
            className={`w-10 shrink-0 text-xs tabular-nums ${
              burnTone === 'red' ? 'text-red-700 font-medium' : burnTone === 'amber' ? 'text-amber-700' : r.burn == null ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            {r.burn != null ? `${r.burn}%` : '—'}
          </span>
          {r.burn != null ? <MiniBar pct={r.burn} tone={burnTone} /> : null}
        </div>
        {projectedOver ? <div className="text-[11px] text-gray-400 whitespace-nowrap">proj. {r.projectedHours}h</div> : null}
      </td>

      <td className="hidden md:table-cell md:px-3 md:py-2.5 align-middle">
        <div className="flex items-center gap-2 min-w-0 w-full max-w-[9rem]">
          <span className={`w-8 shrink-0 text-xs tabular-nums ${r.milestonesTotal ? 'text-gray-700' : 'text-gray-300'}`}>
            {r.milestonesTotal ? `${r.milestonesDone}/${r.milestonesTotal}` : '—'}
          </span>
          {r.milestonesTotal ? (
            <MiniBar pct={msPct} tone={r.milestonesDone === r.milestonesTotal ? 'green' : 'neutral'} />
          ) : null}
        </div>
      </td>

      <td className="hidden lg:table-cell lg:pl-3 lg:pr-5 lg:py-2.5 align-middle text-right">
        <span className="text-xs text-gray-400 whitespace-nowrap">{clientUpdate}</span>
      </td>
    </ClickableRow>
  )
}

function FilterChip({
  active,
  onClick,
  count,
  label,
  dot,
  activeClass,
}: {
  active: boolean
  onClick: () => void
  count: number
  label: string
  dot?: string
  activeClass: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      disabled={count === 0 && !active}
      className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-40 disabled:cursor-default ${
        active ? activeClass : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-50'
      }`}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

/** Business → Summary project health: filter strip + compact, clickable one-line rows. */
export default function ProjectHealthList({
  rows,
  initialFilter = 'all',
}: {
  rows: ProjectHealthRow[]
  initialFilter?: HealthFilter
}) {
  const [filter, setFilter] = useState<HealthFilter>(initialFilter)

  const counts = {
    'at-risk': rows.filter(r => r.label === 'critical').length,
    attention: rows.filter(r => r.label === 'at_risk').length,
    healthy: rows.filter(r => r.label === 'healthy').length,
  }
  const shown = filter === 'all' ? rows : rows.filter(r => r.label === FILTER_LABEL[filter])

  function choose(next: HealthFilter) {
    const value = next === filter ? 'all' : next
    setFilter(value)
    // Keep the choice linkable (?health=) without a server round-trip.
    const url = new URL(window.location.href)
    if (value === 'all') url.searchParams.delete('health')
    else url.searchParams.set('health', value)
    window.history.replaceState(null, '', url.toString())
  }

  return (
    <>
      <div className="flex flex-nowrap items-center gap-2 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50 overflow-x-auto scrollbar-hide">
        <FilterChip
          active={filter === 'all'}
          onClick={() => choose('all')}
          count={rows.length}
          label="All"
          activeClass="bg-gray-900 text-white ring-gray-900"
        />
        <FilterChip
          active={filter === 'at-risk'}
          onClick={() => choose('at-risk')}
          count={counts['at-risk']}
          label="At risk"
          dot="bg-red-500"
          activeClass="bg-red-50 text-red-700 ring-red-300"
        />
        <FilterChip
          active={filter === 'attention'}
          onClick={() => choose('attention')}
          count={counts.attention}
          label="Needs attention"
          dot="bg-amber-500"
          activeClass="bg-amber-50 text-amber-800 ring-amber-300"
        />
        <FilterChip
          active={filter === 'healthy'}
          onClick={() => choose('healthy')}
          count={counts.healthy}
          label="Healthy"
          dot="bg-emerald-500"
          activeClass="bg-emerald-50 text-emerald-700 ring-emerald-300"
        />
      </div>

      {shown.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">No projects in this group.</p>
      ) : (
        <table className="block w-full md:table text-sm table-fixed">
          <thead className="hidden md:table-header-group">
            <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
              <th className="text-left pl-5 pr-2 py-2 font-medium w-14">Score</th>
              <th className="text-left px-3 py-2 font-medium w-full">Project</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Status</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Timeline</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Hours</th>
              <th className="text-left px-3 py-2 font-medium whitespace-nowrap">Milestones</th>
              <th className="hidden lg:table-cell text-right pl-3 pr-5 py-2 font-medium whitespace-nowrap">Client update</th>
            </tr>
          </thead>
          <ShowMoreRows
            key={filter}
            rows={shown.map(r => <Row key={r.id} r={r} />)}
            initial={VISIBLE_PROJECTS}
            colSpan={COLS}
            noun="projects"
            className="block w-full md:table-row-group divide-y divide-gray-100"
            toggleClassName="block w-full md:table-cell px-5 py-2.5"
          />
        </table>
      )}
    </>
  )
}
