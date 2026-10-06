import { addDays, differenceInCalendarDays, startOfDay, subDays } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { momClientLabel } from '@/lib/mom'
import { getMomFinalStatusMap } from '@/lib/mom-form'
import { fmtDate, normalizeMomFinalStatus } from '@/lib/utils'

/**
 * Founder / Manager "Needs you" home.
 *
 * Exceptions only — every item here needs a decision or a push from a lead.
 * On-track work is intentionally left out. Reuses the same rules as the MOM
 * attention board (src/app/mom/page.tsx).
 *
 * Leave / WFH approvals are deliberately NOT here — that is HR work and lives on
 * /leaves (HR keeps the pending-leave nav badge). "Waiting on you" only holds
 * business decisions a lead owns: pending scope changes and blockers escalated
 * to the Founder.
 */

/** Founder and Manager share the lead view (same ROLE_ACCESS, both land on `/`). */
export function isLeadRole(role: string | null | undefined) {
  return role === 'Founder' || role === 'Manager'
}

export type AttentionGroupKey = 'waiting' | 'overdue' | 'stuck' | 'at_risk' | 'due_soon'

/** The single primary action a row offers. All map onto existing endpoints or a plain link. */
export type AttentionRowAction =
  | { kind: 'resolve_blocker'; blockerId: string }
  | { kind: 'nudge'; actionId: string }
  | { kind: 'reopen'; momId: string; actionId: string }
  | { kind: 'open'; label?: string }

export type AttentionRow = {
  id: string
  title: string
  /** Plain one-line context, e.g. "Acme · owner Riya". */
  meta: string
  /** Short urgency text shown in the row tone colour, e.g. "3d overdue". */
  urgency?: string
  href: string
  action: AttentionRowAction
}

export type AttentionGroup = {
  key: AttentionGroupKey
  label: string
  /** red = needs action, amber = due soon. Zero items always renders neutral. */
  tone: 'red' | 'amber'
  hint: string
  count: number
  rows: AttentionRow[]
  seeAllHref: string
  seeAllLabel: string
}

export type FounderAttention = {
  groups: AttentionGroup[]
  total: number
  /** Counts used by the morning digest. */
  digest: {
    overdue: number
    stuck: number
    blockedSinceYesterday: number
    /** Pending scope changes (part of "Waiting on you"). */
    scopeChanges: number
    /** Blockers escalated to the Founder (part of "Waiting on you"). */
    escalatedBlockers: number
    atRisk: number
  }
}

const OPENISH = ['Open', 'InProgress', 'Blocked']
const ROW_LIMIT = 8

function daysLabel(days: number) {
  return `${days}d overdue`
}

function truncate(text: string, max = 80) {
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export async function getFounderAttention(opts: {
  /** Viewer id — used to avoid "nudge yourself" rows. */
  viewerId?: string | null
  /** Viewer role — only the Founder can resolve blockers via /api/blockers/[id]. */
  viewerRole?: string | null
  now?: Date
} = {}): Promise<FounderAttention> {
  const now = opts.now ?? new Date()
  const today = startOfDay(now)
  const tomorrowEnd = addDays(today, 2) // due today or tomorrow
  const weekAgo = subDays(now, 7)
  const dayAgo = subDays(now, 1)

  const [allActions, allStuckActions, allPendingFollowUps, scopeChanges, blockers, projects] =
    await Promise.all([
      prisma.momActionItem.findMany({
        where: { status: { in: OPENISH }, dueDate: { lt: tomorrowEnd } },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          blockedReason: true,
          updatedAt: true,
          ownerId: true,
          owner: { select: { name: true } },
          mom: { select: { id: true, parentId: true, clientName: true, companyName: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
      // Blocked actions are not filtered by due date — fetch them separately.
      prisma.momActionItem.findMany({
        where: {
          OR: [
            { status: 'Blocked' },
            { status: 'NotCompleted', updatedAt: { gte: weekAgo } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          blockedReason: true,
          updatedAt: true,
          momId: true,
          owner: { select: { name: true } },
          mom: { select: { id: true, parentId: true, clientName: true, companyName: true } },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      prisma.meetingMinute.findMany({
        where: { followUpDate: { not: null, lt: tomorrowEnd }, followUpCompletedAt: null },
        select: {
          id: true,
          parentId: true,
          clientName: true,
          companyName: true,
          followUpDate: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { followUpDate: 'asc' },
      }),
      prisma.scopeChange.findMany({
        where: { approvalStatus: 'pending' },
        select: {
          id: true,
          description: true,
          hoursAdded: true,
          createdAt: true,
          requestedBy: true,
          project: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.blocker.findMany({
        where: {
          status: { not: 'resolved' },
          OR: [{ escalatedToFounder: true }, { status: 'escalated' }, { category: 'dependency' }],
        },
        select: {
          id: true,
          description: true,
          category: true,
          status: true,
          escalatedToFounder: true,
          raisedAt: true,
          member: { select: { name: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { raisedAt: 'asc' },
      }),
      prisma.project.findMany({
        where: { status: { in: ['active', 'qa', 'scoping'] } },
        select: {
          id: true,
          name: true,
          developer: { select: { name: true } },
          checkIns: { orderBy: { weekOf: 'desc' }, take: 1, select: { onTrack: true, progressPct: true } },
        },
      }),
    ])

  // Deals marked Closed don't need the Founder — drop their MOM items from the home.
  // (The /mom attention counts still include them; this page is exceptions only.)
  const rootOf = (m: { id: string; parentId: string | null }) => m.parentId ?? m.id
  const rootIds = [
    ...new Set([
      ...allActions.map(a => rootOf(a.mom)),
      ...allStuckActions.map(a => rootOf(a.mom)),
      ...allPendingFollowUps.map(rootOf),
    ]),
  ]
  const statusMap = await getMomFinalStatusMap(rootIds).catch(() => ({}) as Record<string, string>)
  const isLiveDeal = (rootId: string) => normalizeMomFinalStatus(statusMap[rootId]) !== 'Closed'
  const actions = allActions.filter(a => isLiveDeal(rootOf(a.mom)))
  const notCompleted = allStuckActions.filter(a => isLiveDeal(rootOf(a.mom)))
  const pendingFollowUps = allPendingFollowUps.filter(m => isLiveDeal(rootOf(m)))

  // Escalated blockers wait on the Founder's decision; plain dependency
  // blockers (not escalated) stay under "Stuck".
  const isEscalated = (b: { status: string; escalatedToFounder: boolean }) =>
    b.escalatedToFounder || b.status === 'escalated'
  const escalatedBlockers = blockers.filter(isEscalated)
  const dependencyBlockers = blockers.filter(b => !isEscalated(b))
  // PATCH /api/blockers/[id] allows Founder (not Manager) — others just open the list.
  const canResolveBlockers = opts.viewerRole === 'Founder'

  // ── Waiting on you: business decisions a lead owns ──────────────────────────
  // (Leave / WFH approvals are HR work and intentionally excluded.)
  const waitingRows: AttentionRow[] = [
    ...scopeChanges.map(sc => ({
      id: `scope-${sc.id}`,
      title: `Scope change · ${sc.project.name}`,
      meta: `${truncate(sc.description, 70)}${sc.hoursAdded ? ` · +${sc.hoursAdded}h` : ''}`,
      href: `/projects/${sc.project.id}`,
      action: { kind: 'open' as const, label: 'Review' },
    })),
    ...escalatedBlockers.map(b => {
      const ageDays = differenceInCalendarDays(today, startOfDay(b.raisedAt))
      return {
        id: `escalated-${b.id}`,
        title: truncate(b.description, 80),
        meta: `${b.project?.name ?? 'No project'} · ${b.member.name}`,
        urgency: ageDays > 0 ? `Escalated · ${ageDays}d old` : 'Escalated',
        // There is no standalone blockers page any more — open the project for context.
        href: b.project ? `/projects/${b.project.id}` : '/?open=waiting',
        action: canResolveBlockers
          ? { kind: 'resolve_blocker' as const, blockerId: b.id }
          : { kind: 'open' as const },
      }
    }),
  ]

  // ── Overdue: open MOM actions + next calls past their date ─────────────────
  const overdueActions = actions.filter(
    a => a.status !== 'Blocked' && differenceInCalendarDays(today, startOfDay(a.dueDate)) > 0
  )
  const overdueCalls = pendingFollowUps.filter(
    m => differenceInCalendarDays(today, startOfDay(m.followUpDate!)) > 0
  )
  const overdueRows: (AttentionRow & { days: number })[] = [
    ...overdueActions.map(a => {
      const days = differenceInCalendarDays(today, startOfDay(a.dueDate))
      const canNudge = a.ownerId !== opts.viewerId
      return {
        id: `action-${a.id}`,
        days,
        title: a.title,
        meta: `${momClientLabel(a.mom.clientName, a.mom.companyName)} · ${a.owner.name}`,
        urgency: daysLabel(days),
        href: `/mom/${a.mom.parentId ?? a.mom.id}`,
        action: canNudge ? { kind: 'nudge' as const, actionId: a.id } : { kind: 'open' as const },
      }
    }),
    ...overdueCalls.map(m => {
      const days = differenceInCalendarDays(today, startOfDay(m.followUpDate!))
      return {
        id: `call-${m.id}`,
        days,
        title: `Next call with ${m.clientName}`,
        meta: `${momClientLabel(m.clientName, m.companyName)} · ${m.createdBy.name}`,
        urgency: daysLabel(days),
        href: `/mom/${m.parentId ?? m.id}`,
        action: { kind: 'open' as const },
      }
    }),
  ].sort((a, b) => b.days - a.days)

  // ── Stuck: Blocked actions + Not completed (last 7d) + dependency blockers ──
  // (Escalated blockers moved to "Waiting on you" so nothing is counted twice.)
  const blockedActions = notCompleted.filter(a => a.status === 'Blocked')
  const recentlyNotCompleted = notCompleted.filter(a => a.status === 'NotCompleted')
  const blockedSinceYesterday = blockedActions.filter(a => a.updatedAt >= dayAgo).length

  const stuckRows: AttentionRow[] = [
    ...blockedActions.map(a => ({
      id: `blocked-${a.id}`,
      title: a.title,
      meta: `${momClientLabel(a.mom.clientName, a.mom.companyName)} · ${a.owner.name} · ${truncate(a.blockedReason || 'No reason given', 60)}`,
      urgency: 'Blocked',
      href: `/mom/${a.mom.parentId ?? a.mom.id}`,
      action: { kind: 'open' as const },
    })),
    ...dependencyBlockers.map(b => ({
      id: `blocker-${b.id}`,
      title: truncate(b.description, 80),
      meta: `${b.project?.name ?? 'No project'} · ${b.member.name}`,
      urgency: 'Dependency',
      href: b.project ? `/projects/${b.project.id}` : '/?open=stuck',
      action: { kind: 'open' as const },
    })),
    ...recentlyNotCompleted.map(a => ({
      id: `notdone-${a.id}`,
      title: a.title,
      meta: `${momClientLabel(a.mom.clientName, a.mom.companyName)} · ${a.owner.name} · was due ${fmtDate(a.dueDate)}`,
      urgency: 'Not completed',
      href: `/mom/${a.mom.parentId ?? a.mom.id}`,
      action: { kind: 'reopen' as const, momId: a.momId, actionId: a.id },
    })),
  ]

  // ── At risk: active projects whose latest check-in says late / at risk ─────
  const atRiskRows: AttentionRow[] = projects
    .filter(p => {
      const ci = p.checkIns[0]
      return ci && (ci.onTrack === 'no' || ci.onTrack === 'at_risk')
    })
    // Late first, then at risk
    .sort((a, b) => (a.checkIns[0]!.onTrack === 'no' ? 0 : 1) - (b.checkIns[0]!.onTrack === 'no' ? 0 : 1))
    .map(p => {
      const ci = p.checkIns[0]!
      return {
        id: `project-${p.id}`,
        title: p.name,
        meta: `${p.developer.name} · ${ci.progressPct}% done`,
        urgency: ci.onTrack === 'no' ? 'Late' : 'At risk',
        href: `/projects/${p.id}`,
        action: { kind: 'open' as const },
      }
    })

  // ── Due soon: today / tomorrow (not yet overdue) ───────────────────────────
  const dueSoonRows: AttentionRow[] = [
    ...actions
      .filter(a => a.status !== 'Blocked')
      .filter(a => {
        const d = differenceInCalendarDays(startOfDay(a.dueDate), today)
        return d === 0 || d === 1
      })
      .map(a => {
        const d = differenceInCalendarDays(startOfDay(a.dueDate), today)
        return {
          id: `soon-action-${a.id}`,
          title: a.title,
          meta: `${momClientLabel(a.mom.clientName, a.mom.companyName)} · ${a.owner.name}`,
          urgency: d === 0 ? 'Due today' : 'Due tomorrow',
          href: `/mom/${a.mom.parentId ?? a.mom.id}`,
          action: { kind: 'open' as const },
        }
      }),
    ...pendingFollowUps
      .filter(m => {
        const d = differenceInCalendarDays(startOfDay(m.followUpDate!), today)
        return d === 0 || d === 1
      })
      .map(m => {
        const d = differenceInCalendarDays(startOfDay(m.followUpDate!), today)
        return {
          id: `soon-call-${m.id}`,
          title: `Next call with ${m.clientName}`,
          meta: `${momClientLabel(m.clientName, m.companyName)} · ${m.createdBy.name}`,
          urgency: d === 0 ? 'Today' : 'Tomorrow',
          href: `/mom/${m.parentId ?? m.id}`,
          action: { kind: 'open' as const },
        }
      }),
  ]

  const groups: AttentionGroup[] = [
    {
      key: 'waiting',
      label: 'Waiting on you',
      tone: 'red',
      hint: 'Scope changes and escalated blockers that need your decision.',
      count: waitingRows.length,
      rows: waitingRows.slice(0, ROW_LIMIT),
      // Scope changes live on each project; escalated blockers are listed here only.
      seeAllHref: '/projects',
      seeAllLabel: 'All projects',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      tone: 'red',
      hint: 'MOM actions and next calls past their date.',
      count: overdueRows.length,
      rows: overdueRows.slice(0, ROW_LIMIT).map(({ days: _days, ...row }) => row),
      seeAllHref: '/mom?filter=overdue',
      seeAllLabel: 'All overdue in MOM',
    },
    {
      key: 'stuck',
      label: 'Stuck',
      tone: 'red',
      hint: 'Blocked, waiting on a dependency, or not completed this week.',
      count: stuckRows.length,
      rows: stuckRows.slice(0, ROW_LIMIT),
      seeAllHref: '/mom?filter=blocked',
      seeAllLabel: 'All blocked in MOM',
    },
    {
      key: 'at_risk',
      label: 'Projects at risk',
      tone: 'amber',
      hint: 'Latest weekly check-in says late or at risk.',
      count: atRiskRows.length,
      rows: atRiskRows.slice(0, ROW_LIMIT),
      seeAllHref: '/projects',
      seeAllLabel: 'All projects',
    },
    {
      key: 'due_soon',
      label: 'Due soon',
      tone: 'amber',
      hint: 'MOM actions and next calls due today or tomorrow.',
      count: dueSoonRows.length,
      rows: dueSoonRows.slice(0, ROW_LIMIT),
      seeAllHref: '/mom?filter=due_soon',
      seeAllLabel: 'All due soon in MOM',
    },
  ]

  return {
    groups,
    total: groups.reduce((s, g) => s + g.count, 0),
    digest: {
      overdue: overdueRows.length,
      stuck: stuckRows.length,
      blockedSinceYesterday,
      scopeChanges: scopeChanges.length,
      escalatedBlockers: escalatedBlockers.length,
      atRisk: atRiskRows.length,
    },
  }
}
