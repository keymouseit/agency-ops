import Link from 'next/link'
import { differenceInDays, startOfDay, subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { fmtCurrency } from '@/lib/utils'
import { calcHealth, compareProjectHealth, burnPct, marginSignal } from '@/lib/project-health'
import { deliveryStats } from '@/lib/delivery-stats'
import { KpiGrid, type Kpi, type KpiTone } from '@/components/KpiCard'
import ProjectHealthList, { type HealthFilter, type ProjectHealthRow } from './ProjectHealthList'

type Tone = KpiTone

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Business → Summary: 4 headline numbers, one project health list, trimmed flags. */
export default async function SummaryTab({ healthFilter = 'all' }: { healthFilter?: HealthFilter }) {
  const today = startOfDay(new Date())

  const [leads, projects, delivered, unsignedScope, clientIssues] = await Promise.all([
    prisma.lead.findMany({ select: { status: true, budget: true } }),
    prisma.project.findMany({
      where: { status: { in: ['active', 'qa', 'scoping'] } },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        estimatedEnd: true,
        estimatedHours: true,
        actualHours: true,
        contractValue: true,
        currency: true,
        developer: { select: { name: true } },
        milestones: { select: { status: true } },
        scopeChanges: { select: { changeOrderSigned: true } },
        postDeliveryIssues: { select: { id: true } },
        releaseSignOff: { select: { id: true } },
        checkIns: {
          orderBy: { weekOf: 'desc' },
          take: 4,
          select: { weekOf: true, onTrack: true, clientUpdated: true, blockers: true },
        },
        dailyTasks: {
          where: { createdAt: { gte: subDays(today, 30) }, actualHours: { not: null } },
          select: { taskType: true, actualHours: true },
        },
      },
    }),
    prisma.project.findMany({
      where: { status: 'delivered' },
      select: { estimatedHours: true, actualHours: true, onTime: true },
    }),
    prisma.scopeChange.findMany({
      where: { changeOrderSigned: false },
      select: { project: { select: { id: true, name: true } } },
    }),
    prisma.postDeliveryIssue.findMany({
      where: { resolvedAt: null },
      select: { project: { select: { id: true, name: true } } },
    }),
  ])

  // ── Headline numbers ──────────────────────────────────────────────────────
  const openLeads = leads.filter(l => !['won', 'lost'].includes(l.status))
  const wonLeads = leads.filter(l => l.status === 'won')
  const closedCount = leads.filter(l => ['won', 'lost'].includes(l.status)).length
  const pipeline = openLeads.reduce((s, l) => s + (l.budget || 0), 0)
  const wonRevenue = wonLeads.reduce((s, l) => s + (l.budget || 0), 0)
  const winRate = closedCount ? Math.round((wonLeads.length / closedCount) * 100) : null
  const { withData, onTimeCount, onTimeRate } = deliveryStats(delivered)

  // ── Project health (0–10, worst first) ────────────────────────────────────
  const health = projects
    .map(p => {
      const h = calcHealth(p)
      const daysLeft = p.estimatedEnd ? differenceInDays(new Date(p.estimatedEnd), new Date()) : null
      const daysTotal =
        p.startDate && p.estimatedEnd ? differenceInDays(new Date(p.estimatedEnd), new Date(p.startDate)) : null
      const daysElapsed = p.startDate ? differenceInDays(new Date(), new Date(p.startDate)) : 0
      const schedulePct = daysTotal && daysTotal > 0 ? Math.round((daysElapsed / daysTotal) * 100) : null
      const burn = burnPct(p.estimatedHours, p.actualHours)
      const projectedHours =
        p.estimatedHours && p.actualHours && daysElapsed > 0 && daysTotal
          ? Math.round((p.actualHours / daysElapsed) * daysTotal)
          : null
      const projectedCost =
        p.contractValue && p.estimatedHours && p.actualHours
          ? (p.actualHours / (p.estimatedHours * 0.7)) * p.contractValue
          : null
      const overBudget =
        !!(p.contractValue && p.estimatedHours) &&
        marginSignal(p.estimatedHours, p.actualHours, projectedCost, p.contractValue) === 'over_budget'
      const lastClientUpdate = p.checkIns.find(c => c.clientUpdated)
      const daysSinceClientUpdate = lastClientUpdate ? differenceInDays(new Date(), new Date(lastClientUpdate.weekOf)) : null
      const milestonesDone = p.milestones.filter(m => m.status === 'done').length
      const unsignedCOs = p.scopeChanges.filter(s => !s.changeOrderSigned).length
      const timeByType = Object.entries(
        p.dailyTasks.reduce((acc, t) => {
          acc[t.taskType] = (acc[t.taskType] || 0) + (t.actualHours || 0)
          return acc
        }, {} as Record<string, number>)
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
      return {
        p, h, daysLeft, schedulePct, burn, projectedHours, overBudget,
        daysSinceClientUpdate, milestonesDone, unsignedCOs, timeByType,
      }
    })
    .sort((a, b) => compareProjectHealth(a.h, b.h, a.p.name, b.p.name))

  const critical = health.filter(r => r.h.label === 'critical').length
  const atRisk = health.filter(r => r.h.label === 'at_risk').length

  // ── Flags Needs you does not already cover ────────────────────────────────
  type Flag = { key: string; title: string; tone: 'red' | 'amber'; projects: { id: string; name: string }[] }
  const uniqueProjects = (list: { id: string; name: string }[]) =>
    Array.from(new Map(list.map(p => [p.id, p])).values())
  const flags: Flag[] = [
    {
      key: 'client_issues',
      title: 'Client reported an issue after delivery',
      tone: 'red' as const,
      projects: uniqueProjects(clientIssues.map(i => i.project)),
    },
    {
      key: 'unsigned_co',
      title: `${unsignedScope.length} scope change${unsignedScope.length === 1 ? '' : 's'} without a signed change order`,
      tone: 'red' as const,
      projects: uniqueProjects(unsignedScope.map(s => s.project)),
    },
    {
      key: 'qa_no_signoff',
      title: 'In QA with no release sign-off',
      tone: 'amber' as const,
      projects: projects.filter(p => p.status === 'qa' && !p.releaseSignOff).map(p => ({ id: p.id, name: p.name })),
    },
    {
      key: 'no_client_update',
      title: 'No client update in the latest check-in',
      tone: 'amber' as const,
      projects: projects
        .filter(p => p.checkIns[0] && !p.checkIns[0].clientUpdated)
        .map(p => ({ id: p.id, name: p.name })),
    },
  ].filter(f => f.projects.length > 0)

  // ── Rows for the client list (serialisable) ───────────────────────────────
  const rows: ProjectHealthRow[] = health.map(r => ({
    id: r.p.id,
    name: r.p.name,
    owner: r.p.developer.name,
    score: r.h.score,
    label: r.h.label,
    daysLeft: r.daysLeft,
    onTrack: r.p.checkIns[0]?.onTrack ?? null,
    burn: r.burn,
    estimatedHours: r.p.estimatedHours,
    actualHours: r.p.actualHours,
    projectedHours: r.projectedHours,
    milestonesDone: r.milestonesDone,
    milestonesTotal: r.p.milestones.length,
    daysSinceClientUpdate: r.daysSinceClientUpdate,
    overBudget: r.overBudget,
    unsignedCOs: r.unsignedCOs,
    contractValueLabel: r.p.contractValue ? fmtCurrency(r.p.contractValue, r.p.currency) : null,
    timeByType: r.timeByType.length ? r.timeByType.map(([t, hrs]) => `${t} ${hrs.toFixed(0)}h`).join(' · ') : null,
    blocker: r.p.checkIns[0]?.blockers?.trim() || null,
  }))

  // ── KPI cards: colour only when it is really bad; grey + hint when there is no data ──
  const onTimeTone: Tone =
    onTimeRate == null ? 'muted' : onTimeRate < 60 ? (withData.length >= 3 ? 'red' : 'amber') : onTimeRate < 80 ? 'amber' : 'normal'
  const winRateTone: Tone =
    winRate == null || closedCount < 5 ? (winRate == null ? 'muted' : 'normal') : winRate < 15 ? 'red' : winRate < 30 ? 'amber' : 'normal'

  const kpis: Kpi[] = [
    {
      label: 'Active pipeline',
      value: fmtCurrency(pipeline),
      sub: openLeads.length ? plural(openLeads.length, 'open lead') : 'No open leads',
      hint: openLeads.length && !pipeline ? 'No budgets entered on open leads' : undefined,
      tone: pipeline > 0 ? 'normal' : 'muted',
      tint: 'indigo',
      icon: 'pipeline',
      href: '/overview?tab=sales',
      cta: 'Open Sales',
    },
    {
      label: 'Revenue won',
      value: fmtCurrency(wonRevenue),
      sub: wonLeads.length ? `${plural(wonLeads.length, 'won deal')} (total)` : 'No deals won yet',
      hint: wonLeads.length && !wonRevenue ? 'No budgets entered on won deals' : undefined,
      tone: wonRevenue > 0 ? 'normal' : 'muted',
      tint: 'emerald',
      icon: 'revenue',
      href: '/overview?tab=sales',
      cta: 'Open Sales',
    },
    {
      label: 'Win rate',
      value: winRate != null ? `${winRate}%` : '—',
      sub: closedCount ? `${wonLeads.length} won of ${closedCount} closed` : 'No deals closed yet',
      hint: closedCount > 0 && closedCount < 5 ? 'Too few closed deals to judge' : undefined,
      tone: winRateTone,
      tint: 'sky',
      icon: 'winrate',
      href: '/overview?tab=sales',
      cta: 'Open Sales',
    },
    {
      label: 'On-time delivery',
      value: onTimeRate != null ? `${onTimeRate}%` : '—',
      sub: withData.length ? `${onTimeCount} of ${withData.length} delivered on time` : 'No delivered projects yet',
      hint: withData.length ? 'Target ≥80%' : undefined,
      tone: onTimeTone,
      tint: 'teal',
      icon: 'ontime',
      href: '/overview?tab=delivery',
      cta: 'Open Delivery',
    },
  ]

  return (
    <div className="space-y-6">
      <KpiGrid kpis={kpis} />

      <section className="card overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">
              Project health <span className="text-gray-400 font-normal">· {health.length} active</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Score out of 10, worst first
              {critical || atRisk ? (
                <>
                  {' · '}
                  {critical > 0 && <span className="text-red-600">{critical} at risk</span>}
                  {critical > 0 && atRisk > 0 && ', '}
                  {atRisk > 0 && <span className="text-amber-700">{atRisk} need{atRisk === 1 ? 's' : ''} attention</span>}
                </>
              ) : null}
            </p>
          </div>
          <Link href="/projects" className="text-xs text-gray-500 hover:text-gray-900 shrink-0">
            All projects →
          </Link>
        </div>
        {health.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">No active projects.</p>
        ) : (
          <ProjectHealthList rows={rows} initialFilter={healthFilter} />
        )}
      </section>

      {flags.length > 0 && (
        <section className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Flags <span className="text-gray-400 font-normal">· {flags.length}</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Not covered on Needs you.</p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">
            {flags.map((f, i) => (
              <li
                key={f.key}
                className={`bg-white px-5 py-3 ${i === flags.length - 1 && flags.length % 2 === 1 ? 'sm:col-span-2' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${f.tone === 'red' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0">
                    <div className={`text-sm font-medium ${f.tone === 'red' ? 'text-red-800' : 'text-amber-800'}`}>{f.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      {f.projects.slice(0, 5).map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`} className="hover:text-gray-900 hover:underline">
                          {p.name}
                        </Link>
                      ))}
                      {f.projects.length > 5 && <span>+{f.projects.length - 5} more</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
