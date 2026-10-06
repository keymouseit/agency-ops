import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { fmtCurrency, fmtDate, formatLossReason } from '@/lib/utils'
import ClickableRow from '@/components/ClickableRow'
import EmptyState from '@/components/EmptyState'
import InitialAvatar from '@/components/InitialAvatar'
import { KpiGrid, type Kpi, type KpiTone } from '@/components/KpiCard'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "no_proposal" → "No proposal", "Proposal_Quality" → "Proposal Quality", keeps "BD". */
const prettyKey = (k: string) => {
  const s = k.replace(/_/g, ' ').trim()
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

/** Same thresholds as Summary: only judge with 5+ closed deals; <15% red, <30% amber. */
const MIN_CLOSED_TO_JUDGE = 5
function winRateTone(wr: number | null, closed: number): KpiTone {
  if (wr == null) return 'muted'
  if (closed < MIN_CLOSED_TO_JUDGE) return 'normal'
  return wr < 15 ? 'red' : wr < 30 ? 'amber' : 'normal'
}

function WinRatePill({ wr, closed }: { wr: number; closed: number }) {
  const tooFew = closed < MIN_CLOSED_TO_JUDGE
  const tone = winRateTone(wr, closed)
  const cls = tooFew
    ? 'bg-gray-50 text-gray-500 ring-gray-200'
    : tone === 'red'
      ? 'bg-red-50 text-red-700 ring-red-200'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-white text-gray-900 ring-gray-200'
  return (
    <span
      className={`inline-flex min-w-[3rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ring-1 ring-inset ${cls}`}
      title={
        tooFew
          ? `Too few closed deals to judge (${closed} closed, need ${MIN_CLOSED_TO_JUDGE}+)`
          : `${wr}% of ${closed} closed deals won`
      }
    >
      {wr}%
    </span>
  )
}

/** Neutral → red by share; the top item is always the strongest shade. */
function barShade(pct: number, isTop: boolean) {
  if (isTop) return 'bg-red-500'
  if (pct >= 40) return 'bg-red-400'
  if (pct >= 25) return 'bg-red-300'
  if (pct >= 10) return 'bg-rose-200'
  return 'bg-gray-300'
}

function BreakdownCard({
  title,
  entries,
  total,
  format = prettyKey,
  emptyHint,
}: {
  title: string
  entries: Record<string, number>
  total: number
  format?: (k: string) => string
  emptyHint: string
}) {
  const rows = Object.entries(entries).sort((a, b) => b[1] - a[1])
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{title}</h3>
        {total > 0 ? <span className="text-[11px] text-gray-400 tabular-nums">{total} total</span> : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState compact icon="chart" title="Nothing recorded" hint={emptyHint} />
      ) : (
        <ul className="space-y-1">
          {rows.map(([key, count], i) => {
            const pct = total ? Math.round((count / total) * 100) : 0
            const top = i === 0
            return (
              <li
                key={key}
                className={`rounded-lg px-2 py-1.5 -mx-2 ${top ? 'bg-red-50/60' : ''}`}
                title={`${format(key)}: ${count} of ${total} (${pct}%)`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`truncate ${top ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                    {format(key)}
                    {top && rows.length > 1 ? (
                      <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wide text-red-600">Top</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-500">
                    <span className={top ? 'font-semibold text-gray-900' : 'text-gray-700'}>{count}</span>
                    <span className="text-gray-300 mx-1">·</span>
                    {pct}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full ${barShade(pct, top)}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Business → Sales → Results: KPI row, per-owner results, recent losses, why we lose. */
export default async function SalesTab() {
  const [leads, members, lossAnalyses] = await Promise.all([
    prisma.lead.findMany({
      select: {
        id: true,
        clientName: true,
        status: true,
        budget: true,
        currency: true,
        updatedAt: true,
        ownerId: true,
        owner: { select: { name: true } },
        lossAnalysis: { select: { reason: true, faultArea: true } },
        proposals: { select: { status: true, sentAt: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.teamMember.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.lossAnalysis.findMany({ select: { reason: true, faultArea: true } }),
  ])

  // ── Sales results per owner (closed leads, active members) ────────────────
  const closedLeads = leads.filter(l => ['won', 'lost'].includes(l.status))
  const byOwner = members
    .map(m => {
      const mine = closedLeads.filter(l => l.ownerId === m.id)
      const won = mine.filter(l => l.status === 'won')
      const lost = mine.filter(l => l.status === 'lost')
      const wr = mine.length ? Math.round((won.length / mine.length) * 100) : 0
      const wonValue = won.reduce((s, l) => s + (l.budget || 0), 0)
      return { member: m, total: mine.length, won: won.length, lost: lost.length, wr, wonValue }
    })
    .filter(r => r.total > 0)
    .sort((a, b) => b.wonValue - a.wonValue)

  const ownerTotals = byOwner.reduce(
    (acc, r) => ({ total: acc.total + r.total, won: acc.won + r.won, lost: acc.lost + r.lost, wonValue: acc.wonValue + r.wonValue }),
    { total: 0, won: 0, lost: 0, wonValue: 0 },
  )

  // ── Why we lose: stage, reason, fault area ────────────────────────────────
  const lostLeads = leads.filter(l => l.status === 'lost')
  const lossStage = lostLeads.reduce((acc, l) => {
    const last = [...l.proposals].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0]
    const stage = last?.status || 'no_proposal'
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const lossByReason = lossAnalyses.reduce((acc, la) => {
    acc[la.reason] = (acc[la.reason] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const lossByFault = lossAnalyses.reduce((acc, la) => {
    acc[la.faultArea] = (acc[la.faultArea] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const noAnalysis = lostLeads.filter(l => !l.lossAnalysis).length
  const recentLosses = lostLeads.slice(0, 6)

  // ── KPI row (same lead list, no extra queries) ────────────────────────────
  const wonLeads = leads.filter(l => l.status === 'won')
  const wonValue = wonLeads.reduce((s, l) => s + (l.budget || 0), 0)
  const lostValue = lostLeads.reduce((s, l) => s + (l.budget || 0), 0)
  const closedCount = closedLeads.length
  const winRate = closedCount ? Math.round((wonLeads.length / closedCount) * 100) : null

  const kpis: Kpi[] = [
    {
      label: 'Won',
      value: String(wonLeads.length),
      sub: wonLeads.length ? `${fmtCurrency(wonValue)} won` : 'No deals won yet',
      hint: wonLeads.length && !wonValue ? 'No budgets entered on won deals' : undefined,
      tone: wonLeads.length > 0 ? 'normal' : 'muted',
      tint: 'emerald',
      icon: 'trophy',
      href: '/pipeline?status=won',
      cta: 'Open won leads',
    },
    {
      label: 'Lost',
      value: String(lostLeads.length),
      sub: lostLeads.length ? (lostValue ? `${fmtCurrency(lostValue)} lost` : 'No budgets entered') : 'No deals lost yet',
      hint: lostLeads.length
        ? noAnalysis > 0
          ? `${noAnalysis} without a loss analysis`
          : 'All have a loss analysis'
        : undefined,
      tone: lostLeads.length > 0 ? 'normal' : 'muted',
      tint: 'slate',
      icon: 'lost',
      href: '/pipeline?status=lost',
      cta: 'Open lost leads',
    },
    {
      label: 'Win rate',
      value: winRate != null ? `${winRate}%` : '—',
      sub: closedCount ? `${wonLeads.length} won of ${closedCount} closed` : 'No deals closed yet',
      hint: closedCount > 0 && closedCount < MIN_CLOSED_TO_JUDGE ? 'Too few closed deals to judge' : undefined,
      tone: winRateTone(winRate, closedCount),
      tint: 'sky',
      icon: 'winrate',
      href: '/pipeline',
      cta: 'Open Pipeline',
    },
  ]

  return (
    <div className="space-y-6">
      <KpiGrid kpis={kpis} cols={3} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Sales results by owner ───────────────────────────────────── */}
        <section className="card overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Sales results by owner
              {byOwner.length ? <span className="text-gray-400 font-normal"> · {byOwner.length}</span> : null}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Closed leads per active owner, highest value first</p>
          </div>
          {byOwner.length === 0 ? (
            <EmptyState
              icon="trophy"
              title="No closed leads yet"
              hint="Results appear here once a lead is marked won or lost in Pipeline."
              action={
                <Link href="/pipeline" className="text-xs font-medium text-gray-700 hover:text-gray-900">
                  Open Pipeline →
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="text-left pl-5 pr-2 py-2 font-medium">Owner</th>
                    <th className="text-center px-2 py-2 font-medium">Win rate</th>
                    <th className="text-right px-2 py-2 font-medium">Won</th>
                    <th className="text-right px-2 py-2 font-medium">Lost</th>
                    <th className="text-right pl-2 pr-5 py-2 font-medium whitespace-nowrap">Value won</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byOwner.map(r => (
                    <tr key={r.member.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="pl-5 pr-2 py-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <InitialAvatar name={r.member.name} />
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 truncate">{r.member.name}</div>
                            <div className="text-[11px] text-gray-400">{r.total} closed</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <WinRatePill wr={r.wr} closed={r.total} />
                      </td>
                      <td className={`px-2 py-2.5 text-right tabular-nums ${r.won ? 'text-gray-900' : 'text-gray-300'}`}>{r.won}</td>
                      <td className={`px-2 py-2.5 text-right tabular-nums ${r.lost ? 'text-gray-700' : 'text-gray-300'}`}>{r.lost}</td>
                      <td
                        className={`pl-2 pr-5 py-2.5 text-right tabular-nums whitespace-nowrap ${
                          r.wonValue ? 'font-medium text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {fmtCurrency(r.wonValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {byOwner.length >= 2 ? (
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50/70 text-xs">
                      <td className="pl-5 pr-2 py-2.5 font-semibold uppercase tracking-wide text-gray-500">Total</td>
                      <td className="px-2 py-2.5 text-center">
                        <WinRatePill
                          wr={ownerTotals.total ? Math.round((ownerTotals.won / ownerTotals.total) * 100) : 0}
                          closed={ownerTotals.total}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-gray-900">{ownerTotals.won}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums font-semibold text-gray-700">{ownerTotals.lost}</td>
                      <td className="pl-2 pr-5 py-2.5 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">
                        {fmtCurrency(ownerTotals.wonValue)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
        </section>

        {/* ── Recent losses ────────────────────────────────────────────── */}
        <section className="card overflow-hidden flex flex-col">
          <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">
                Recent losses
                {lostLeads.length ? <span className="text-gray-400 font-normal"> · {lostLeads.length}</span> : null}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Newest first · click a row for the lead</p>
            </div>
            <Link href="/pipeline?status=lost" className="text-xs text-gray-500 hover:text-gray-900 shrink-0">
              All losses →
            </Link>
          </div>
          {recentLosses.length === 0 ? (
            <EmptyState icon="lost" title="No lost leads recorded yet" hint="Nice. Lost leads and their reasons will show up here." />
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {recentLosses.map(l => {
                  const href = `/pipeline/${l.id}`
                  const chips = (
                    <>
                      <span className="badge px-2 text-[11px] tabular-nums bg-gray-100 text-gray-700 whitespace-nowrap">
                        {fmtCurrency(l.budget, l.currency)}
                      </span>
                      {l.lossAnalysis ? (
                        <span className="badge px-2 text-[11px] bg-white text-gray-600 ring-1 ring-inset ring-gray-200 whitespace-nowrap">
                          {formatLossReason(l.lossAnalysis.reason)}
                        </span>
                      ) : (
                        <span className="badge px-2 text-[11px] bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100 whitespace-nowrap">
                          No analysis
                        </span>
                      )}
                    </>
                  )
                  return (
                    <ClickableRow key={l.id} href={href} className="group hover:bg-gray-50/80 transition-colors">
                      <td className="pl-5 pr-2 py-2.5 w-full max-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link href={href} className="font-medium text-gray-900 hover:underline truncate">
                            {l.clientName}
                          </Link>
                          <span
                            className="hidden group-data-[pending=true]:inline-block h-3 w-3 shrink-0 rounded-full border-2 border-gray-300 border-t-gray-700 animate-spin"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {l.owner.name}
                          <span className="mx-1 text-gray-300">·</span>
                          <span className="text-gray-400">{fmtDate(l.updatedAt)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 sm:hidden">{chips}</div>
                      </td>
                      <td className="hidden sm:table-cell px-2 py-2.5 align-middle">
                        <div className="flex items-center justify-end gap-1">{chips}</div>
                      </td>
                      <td className="pl-2 pr-5 py-2.5 align-middle text-right">
                        <Link
                          href={href}
                          className={`text-xs whitespace-nowrap hover:text-gray-900 ${l.lossAnalysis ? 'text-gray-500' : 'font-medium text-gray-700'}`}
                        >
                          {l.lossAnalysis ? 'Analysis →' : 'Add analysis →'}
                        </Link>
                      </td>
                    </ClickableRow>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── Why we lose ──────────────────────────────────────────────── */}
      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">Why we lose</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {plural(lostLeads.length, 'lost lead')}
              {noAnalysis > 0 ? (
                <>
                  {' · '}
                  <span className="text-amber-700">{noAnalysis} without a loss analysis</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        {lostLeads.length === 0 && lossAnalyses.length === 0 ? (
          <EmptyState icon="chart" title="No losses recorded yet" hint="When leads are lost, the stage, reason and fault area are broken down here." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-5 bg-gray-50/50">
            <BreakdownCard
              title="Lost at stage"
              entries={lossStage}
              total={lostLeads.length}
              emptyHint="No lost leads yet."
            />
            <BreakdownCard
              title="Reason"
              entries={lossByReason}
              total={lossAnalyses.length}
              format={formatLossReason}
              emptyHint="Add a loss analysis on the lead in Pipeline."
            />
            <BreakdownCard
              title="Fault area"
              entries={lossByFault}
              total={lossAnalyses.length}
              emptyHint="Add a loss analysis on the lead in Pipeline."
            />
          </div>
        )}
      </section>
    </div>
  )
}
