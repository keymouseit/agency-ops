import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Shared KPI card for the Business report tabs (Summary, Sales, BD activity):
 * tinted icon tile, big number, subline and an optional grey hint.
 * Colour the value only when it is really bad; use `muted` when there is no data.
 */
export type KpiTone = 'normal' | 'muted' | 'amber' | 'red'
export type KpiTint = 'indigo' | 'emerald' | 'sky' | 'teal' | 'violet' | 'slate'
export type KpiIconName =
  | 'pipeline'
  | 'revenue'
  | 'winrate'
  | 'ontime'
  | 'trophy'
  | 'lost'
  | 'touches'
  | 'replies'
  | 'meetings'
  | 'conversion'
  | 'chart'
  | 'inbox'
  | 'calendar'

const TINT: Record<KpiTint, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  sky: 'bg-sky-50 text-sky-600 ring-sky-100',
  teal: 'bg-teal-50 text-teal-600 ring-teal-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const VALUE_TONE: Record<KpiTone, string> = {
  normal: 'text-gray-900',
  muted: 'text-gray-400',
  amber: 'text-amber-700',
  red: 'text-red-600',
}

const PATHS: Record<KpiIconName, ReactNode> = {
  pipeline: <path d="M3 4h18l-7 8.5V18l-4 2v-7.5L3 4z" />,
  revenue: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  winrate: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  ontime: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M9 20h6M10 17h4" />
    </>
  ),
  lost: (
    <>
      <path d="M3 7l6 6 4-4 8 8" />
      <path d="M15 17h6v-6" />
    </>
  ),
  touches: (
    <>
      <path d="M21 3L10 14" />
      <path d="M21 3l-7 18-4-7-7-4 18-7z" />
    </>
  ),
  replies: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  meetings: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
      <path d="M9 15l2 2 4-4" />
    </>
  ),
  conversion: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13l3-8h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z" />
      <path d="M3 13h5l1.5 2.5h5L16 13h5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </>
  ),
}

/** Small stroke icons (no icon library in this app). */
export function KpiIcon({ name, className = 'h-[18px] w-[18px]' }: { name: KpiIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

export type Kpi = {
  label: string
  value: string
  sub: string
  hint?: string
  tone: KpiTone
  tint: KpiTint
  icon: KpiIconName
  /** When set, the whole card is a link. */
  href?: string
  /** Screen-reader text for the link. */
  cta?: string
}

export function KpiCard({ k }: { k: Kpi }) {
  const body = (
    <>
      <div className="flex items-center gap-2.5">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TINT[k.tint]}`}>
          <KpiIcon name={k.icon} />
        </span>
        <span className="text-xs font-medium text-gray-500 leading-tight">{k.label}</span>
        {k.href ? (
          <span className="ml-auto text-xs text-gray-300 transition-colors group-hover:text-gray-500" aria-hidden="true">
            →
          </span>
        ) : null}
      </div>
      <div>
        <div className={`text-2xl font-semibold tabular-nums leading-tight ${VALUE_TONE[k.tone]}`}>{k.value}</div>
        <div className="text-xs text-gray-500 mt-1">{k.sub}</div>
        {k.hint ? <div className="text-[11px] text-gray-400 mt-0.5">{k.hint}</div> : null}
      </div>
    </>
  )

  if (!k.href) return <div className="card p-4 sm:p-5 flex flex-col gap-3">{body}</div>

  return (
    <Link
      href={k.href}
      className="card group p-4 sm:p-5 flex flex-col gap-3 transition hover:border-gray-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/70"
    >
      {body}
      {k.cta ? <span className="sr-only">{k.cta}</span> : null}
    </Link>
  )
}

/** Responsive KPI row: 1 → 2 → 4 columns, or 1 → 3 with `cols={3}`. */
export function KpiGrid({ kpis, cols = 4 }: { kpis: Kpi[]; cols?: 3 | 4 }) {
  const grid = cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={`grid ${grid} gap-3 sm:gap-4`}>
      {kpis.map(k => (
        <KpiCard key={k.label} k={k} />
      ))}
    </div>
  )
}
